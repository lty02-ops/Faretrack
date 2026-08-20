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
      api_key: apiKey,
      adults: String(query.passengers || 1),
      type: query.tripType === 'ONE_WAY' ? '2' : '1'
    });
    if (query.tripType !== 'ONE_WAY') params.set('return_date', query.returnDate);

    const response = await this.fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) throw new Error(`SerpApi request failed (${response.status}).`);

    const data = await response.json();
    if (data.error) throw new Error(`SerpApi request failed: ${data.error}`);

    return [...(data.best_flights || []), ...(data.other_flights || [])]
      .map(mapFlight)
      .filter((flight) => flight.price > 0)
      .slice(0, 12);
  }
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
    seller: 'Google Flights',
    bookingUrl: item.booking_token
      ? `https://www.google.com/travel/flights?booking_token=${encodeURIComponent(item.booking_token)}`
      : 'https://www.google.com/travel/flights'
  };
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

module.exports = { SerpApiGoogleFlightsProvider, createMockFlights };
