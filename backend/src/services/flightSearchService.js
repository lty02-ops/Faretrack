const { validateFlightSearch } = require('../domain/flight');
const { createSearchKey } = require('../utils/searchKey');
const { nowIso, monthKey } = require('../utils/dateUtils');

class FlightSearchService {
  constructor({ provider, cache, repository, monthlyRequestLimit = 200 }) {
    this.provider = provider;
    this.cache = cache;
    this.repository = repository;
    this.limit = monthlyRequestLimit;
    this.usage = new Map();
    this.bookingCache = new Map();
  }

  async search(query, { bypassCache = false } = {}) {
    validateFlightSearch(query);
    const key = createSearchKey(query);
    const cached = !bypassCache && this.cache.get(key);
    if (cached) return { key, ...cached, cached: true };

    this.assertUsageAvailable();
    const providerResult = await this.provider.search(query);
    const flights = Array.isArray(providerResult) ? providerResult : providerResult.flights;
    const priceInsights = Array.isArray(providerResult) ? null : providerResult.priceInsights;
    this.recordUsage();
    this.cache.set(key, { flights, priceInsights });
    await this.repository.save({ key, query, requestedAt: nowIso(), flightCount: flights.length });
    return { key, flights, priceInsights, cached: false };
  }

  async bookingOptions({ bookingToken = '', departureToken = '', selectedFlights = null, query = {} }) {
    const itineraryKey = selectedFlights ? JSON.stringify(selectedFlights) : '';
    const token = itineraryKey || bookingToken || departureToken;
    if (!token || token.length < 10) throw new Error('예약 옵션 토큰이 없습니다.');
    const cached = this.bookingCache.get(token);
    if (cached && cached.expiresAt > Date.now()) return { options: cached.options, cached: true };

    const requestCount = bookingToken ? 1 : 2;
    this.assertUsageAvailable(requestCount);
    const options = await this.provider.bookingOptions({ bookingToken, departureToken, selectedFlights, query });
    this.recordUsage(requestCount);
    this.bookingCache.set(token, { options, expiresAt: Date.now() + 15 * 60 * 1000 });
    return { options, cached: false };
  }

  async returnOptions({ departureToken = '', query = {} }) {
    if (!departureToken || departureToken.length < 10) throw new Error('귀국편 조회 토큰이 없습니다.');
    const cacheKey = `return:${departureToken}`;
    const cached = this.bookingCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { flights: cached.options, cached: true };
    this.assertUsageAvailable();
    const flights = await this.provider.returnOptions(departureToken, query);
    this.recordUsage();
    this.bookingCache.set(cacheKey, { options: flights, expiresAt: Date.now() + 15 * 60 * 1000 });
    return { flights, cached: false };
  }

  assertUsageAvailable(requestCount = 1) {
    if ((this.usage.get(monthKey()) || 0) + requestCount > this.limit) throw new Error('월간 외부 API 호출 한도에 도달했습니다.');
  }

  recordUsage(requestCount = 1) {
    const month = monthKey();
    this.usage.set(month, (this.usage.get(month) || 0) + requestCount);
  }
}

module.exports = { FlightSearchService };
