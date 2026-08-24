const crypto = require('node:crypto');
const { FlightProvider } = require('./flightProvider');

class SerpApiGoogleFlightsProvider extends FlightProvider {
  constructor({ apiKey = '', apiKeyProvider, fetchImpl = fetch, testMode = true } = {}) {
    super();
    this.apiKey = apiKey;
    this.apiKeyProvider = apiKeyProvider;
    this.fetch = fetchImpl;
    this.testMode = testMode;
  }

  async search(query) {
    if (this.testMode) return createMockFlights(query);
    const apiKey = this.apiKey || await this.apiKeyProvider?.();
    if (!apiKey) throw new Error('SerpApi API key is not configured.');

    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: query.origin,
      arrival_id: query.destination,
      outbound_date: query.departureDate,
      currency: 'KRW',
      hl: 'ko',
      gl: 'kr',
      deep_search: 'true',
      show_hidden: 'true',
      api_key: apiKey,
      adults: String(query.passengers || 1),
      type: query.tripType === 'ONE_WAY' ? '2' : '1'
    });
    if (query.tripType !== 'ONE_WAY') params.set('return_date', query.returnDate);
    if (query.outboundTimes) params.set('outbound_times', query.outboundTimes);
    if (query.tripType !== 'ONE_WAY' && query.returnTimes) params.set('return_times', query.returnTimes);
    if (query.stops) params.set('stops', String(query.stops));
    if (Number(query.maxPrice) > 0) params.set('max_price', String(query.maxPrice));

    const response = await this.fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) throw new Error(`SerpApi request failed (${response.status}).`);

    const data = await response.json();
    if (data.error) throw new Error(`SerpApi request failed: ${data.error}`);

    const flights = [...(data.best_flights || []), ...(data.other_flights || [])]
      .map(mapFlight)
      .filter((flight) => flight.price > 0)
      .sort((left, right) => left.price - right.price);
    return { flights, priceInsights: mapPriceInsights(data.price_insights) };
  }

  async bookingOptions({ bookingToken, departureToken, selectedFlights, query = {} }) {
    if (this.testMode) return createMockBookingOptions();
    const apiKey = this.apiKey || await this.apiKeyProvider?.();
    if (!apiKey) throw new Error('SerpApi API key is not configured.');
    if (selectedFlights?.outbound?.length && (query.tripType === 'ONE_WAY' || selectedFlights.return?.length)) {
      const params = new URLSearchParams({
        engine: 'google_flights',
        selected_flights_json: JSON.stringify(selectedFlights),
        type: query.tripType === 'ONE_WAY' ? '2' : '1',
        adults: String(query.passengers || 1),
        currency: 'KRW', hl: 'ko', gl: 'kr', api_key: apiKey
      });
      const response = await this.fetch(`https://serpapi.com/search.json?${params}`);
      const data = await readSerpApiResponse(response, 'booking options');
      return mapBookingOptions(data.booking_options || []);
    }

    let token = bookingToken;
    if (!token && departureToken) {
      const returnParams = createReturnParams(query, departureToken, apiKey);
      const returnResponse = await this.fetch(`https://serpapi.com/search.json?${returnParams}`);
      if (!returnResponse.ok) throw new Error(`SerpApi return flights request failed (${returnResponse.status}).`);
      const returnData = await returnResponse.json();
      if (returnData.error) throw new Error(`SerpApi return flights request failed: ${returnData.error}`);
      const returnFlights = [...(returnData.best_flights || []), ...(returnData.other_flights || [])].sort((left, right) => Number(left.price || 0) - Number(right.price || 0));
      token = returnFlights.find((flight) => flight.booking_token)?.booking_token || '';
    }
    if (!token) throw new Error('이 항공권의 예약 옵션 토큰을 찾지 못했습니다.');
    const params = new URLSearchParams({ engine: 'google_flights', booking_token: token, currency: 'KRW', hl: 'ko', api_key: apiKey });
    const response = await this.fetch(`https://serpapi.com/search.json?${params}`);
    const data = await readSerpApiResponse(response, 'booking options');
    return mapBookingOptions(data.booking_options || []);
  }

  async returnOptions(departureToken, query = {}) {
    if (this.testMode) return createMockReturnFlights();
    const apiKey = this.apiKey || await this.apiKeyProvider?.();
    if (!apiKey) throw new Error('SerpApi API key is not configured.');
    const params = createReturnParams(query, departureToken, apiKey);
    const response = await this.fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) throw new Error(`SerpApi return flights request failed (${response.status}).`);
    const data = await response.json();
    if (data.error) throw new Error(`SerpApi return flights request failed: ${data.error}`);
    const returnFlights = [...(data.best_flights || []), ...(data.other_flights || [])];
    if (returnFlights.length === 0) {
      console.warn('SerpApi returned no return flights', {
        searchId: data.search_metadata?.id,
        status: data.search_metadata?.status,
        parameters: data.search_parameters
      });
    }
    return returnFlights
      .map(mapFlight)
      .filter((flight) => flight.airline !== 'Unknown airline')
      .filter((flight) => matchesHourRange(flight.departureTime, query.returnTimes))
      .sort((left, right) => (left.price || Number.MAX_SAFE_INTEGER) - (right.price || Number.MAX_SAFE_INTEGER))
      .slice(0, 30);
  }
}

function matchesHourRange(dateTime, range) {
  if (!range) return true;
  const [startHour, endHour] = String(range).split(',').map(Number);
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) return true;
  const match = String(dateTime).match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/);
  if (!match) return false;
  const hour = Number(match[1]);
  return hour >= startHour && hour <= endHour;
}

async function readSerpApiResponse(response, operation) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const detail = data.error || data.message || `HTTP ${response.status}`;
    throw new Error(`SerpApi ${operation} request failed: ${detail}`);
  }
  return data;
}

function createReturnParams(query, departureToken, apiKey) {
  const params = new URLSearchParams({
    engine: 'google_flights', departure_token: departureToken,
    departure_id: query.origin || '', arrival_id: query.destination || '',
    outbound_date: query.departureDate || '', return_date: query.returnDate || '',
    type: '1', adults: String(query.passengers || 1),
    currency: 'KRW', hl: 'ko', gl: 'kr', deep_search: 'true',
    show_hidden: 'true', api_key: apiKey
  });
  if (query.outboundTimes) params.set('outbound_times', query.outboundTimes);
  if (query.returnTimes) params.set('return_times', query.returnTimes);
  if (query.stops) params.set('stops', String(query.stops));
  if (Number(query.maxPrice) > 0) params.set('max_price', String(query.maxPrice));
  return params;
}

function mapFlight(item) {
  const first = item.flights?.[0] || {};
  const last = item.flights?.at(-1) || first;
  return {
    id: `flight_${crypto.randomUUID().slice(0, 8)}`,
    airline: first.airline || 'Unknown airline',
    flightNumber: first.flight_number || '-',
    departureTime: first.departure_airport?.time || '-',
    arrivalTime: last.arrival_airport?.time || '-',
    stops: Math.max(0, (item.flights?.length || 1) - 1),
    price: Number(item.price || 0),
    seller: '판매처 확인',
    bookingToken: item.booking_token || '',
    departureToken: item.departure_token || '',
    segments: (item.flights || []).map((flight) => ({
      flight_number: String(flight.flight_number || '').replace(/\s+/g, ''),
      departure_id: flight.departure_airport?.id || '',
      arrival_id: flight.arrival_airport?.id || '',
      date: String(flight.departure_airport?.time || '').slice(0, 10)
    })).filter((segment) => segment.flight_number && segment.departure_id && segment.arrival_id && /^\d{4}-\d{2}-\d{2}$/.test(segment.date)),
    bookingUrl: item.booking_token
      ? `https://www.google.com/travel/flights?booking_token=${encodeURIComponent(item.booking_token)}`
      : 'https://www.google.com/travel/flights'
  };
}

function mapBookingOptions(options) {
  return options.flatMap((option, optionIndex) => {
    const entries = option.separate_tickets
      ? [['가는 편', option.departing], ['오는 편', option.returning]]
      : [['전체 여정', option.together]];
    return entries.filter(([, value]) => value?.book_with).map(([segment, value], entryIndex) => ({
      id: `booking_${optionIndex}_${entryIndex}`,
      seller: value.book_with,
      segment,
      price: Number(value.price || 0),
      logos: value.airline_logos || [],
      url: value.booking_request?.url || '',
      postData: value.booking_request?.post_data || ''
    }));
  });
}

function mapPriceInsights(insights) {
  if (!insights) return null;
  const cutoff = Date.now() / 1000 - 30 * 24 * 60 * 60;
  const history = (insights.price_history || [])
    .filter(([timestamp, price]) => Number(timestamp) >= cutoff && Number(price) > 0)
    .map(([timestamp, price]) => ({ checkedAt: new Date(Number(timestamp) * 1000).toISOString(), price: Number(price) }));
  return {
    lowestPrice: Number(insights.lowest_price || 0),
    priceLevel: insights.price_level || '',
    typicalPriceRange: (insights.typical_price_range || []).map(Number),
    history
  };
}

function createMockBookingOptions() {
  return [{ id: 'booking_mock_0', seller: 'Trip.com', segment: '전체 여정', price: 128000, logos: [], url: 'https://www.trip.com', postData: '' }];
}

function createMockFlights(query) {
  const seed = [...query.origin, ...query.destination].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const base = 128000 + (seed % 7) * 9000;
  return [
    ['Korean Air', 'KE703', '09:55', '12:20', 0, base, 'Google Flights'],
    ['Asiana Airlines', 'OZ102', '10:50', '13:15', 0, base + 17400, 'Trip.com'],
    ['Jeju Air', '7C1102', '08:10', '10:35', 0, base + 6200, 'Google Flights'],
    ['Jin Air', 'LJ203', '15:20', '17:45', 1, base - 5800, 'Kiwi.com']
  ].map(([airline, flightNumber, departureTime, arrivalTime, stops, price, seller]) => ({
    id: `flight_${crypto.randomUUID().slice(0, 8)}`,
    airline,
    flightNumber,
    departureTime,
    arrivalTime,
    stops,
    price,
    seller,
    bookingUrl: 'https://www.google.com/travel/flights'
  }));
}

function createMockReturnFlights() {
  return createMockFlights({ origin: 'NRT', destination: 'ICN' }).map((flight) => ({
    ...flight,
    bookingToken: `mock_booking_${crypto.randomUUID()}`,
    departureToken: ''
  }));
}

module.exports = { SerpApiGoogleFlightsProvider, createMockFlights, mapBookingOptions, mapPriceInsights };
