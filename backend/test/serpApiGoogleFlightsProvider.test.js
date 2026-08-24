const test = require('node:test');
const assert = require('node:assert/strict');
const { SerpApiGoogleFlightsProvider } = require('../src/providers/serpApiGoogleFlightsProvider');

test('SerpApi search requests complete Korean results and keeps direct flights', async () => {
  let requestedUrl = '';
  const provider = new SerpApiGoogleFlightsProvider({
    apiKey: 'test-key',
    testMode: false,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({
          best_flights: [{ price: 200000, flights: [{ airline: 'Connecting', flight_number: 'CT 1' }, { airline: 'Connecting', flight_number: 'CT 2' }] }],
          other_flights: [{ price: 210000, flights: [{ airline: 'Direct', flight_number: 'DR 1' }] }],
          price_insights: {
            lowest_price: 200000,
            price_level: 'typical',
            typical_price_range: [180000, 260000],
            price_history: [[Math.floor(Date.now() / 1000) - 86400, 190000]]
          }
        })
      };
    }
  });

  const result = await provider.search({
    origin: 'ICN', destination: 'PEK', departureDate: '2026-10-07',
    returnDate: '2026-10-11', tripType: 'ROUND', passengers: 1,
    outboundTimes: '6,8', returnTimes: '18,20', stops: '1', maxPrice: 500000
  });
  const params = new URL(requestedUrl).searchParams;

  assert.equal(params.get('deep_search'), 'true');
  assert.equal(params.get('show_hidden'), 'true');
  assert.equal(params.get('gl'), 'kr');
  assert.equal(params.get('outbound_times'), '6,8');
  assert.equal(params.get('return_times'), '18,20');
  assert.equal(params.get('stops'), '1');
  assert.equal(params.get('max_price'), '500000');
  assert.equal(result.flights.length, 2);
  assert.equal(result.flights.find((flight) => flight.airline === 'Direct').stops, 0);
  assert.equal(result.priceInsights.history.length, 1);
  assert.deepEqual(result.priceInsights.typicalPriceRange, [180000, 260000]);
});

test('return flight time is retained even when booking token is unavailable', async () => {
  let requestedUrl = '';
  const provider = new SerpApiGoogleFlightsProvider({
    apiKey: 'test-key', testMode: false,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return ({
      ok: true,
      json: async () => ({ other_flights: [{
        flights: [{
          airline: 'Jeju Air', flight_number: '7C 1302',
          departure_airport: { time: '2026-10-11 18:00' },
          arrival_airport: { time: '2026-10-11 20:00' }
        }]
      }] })
    }); }
  });
  const [flight] = await provider.returnOptions('departure-token-123', {
    origin: 'ICN', destination: 'FUK', departureDate: '2026-09-08',
    returnDate: '2026-09-12', tripType: 'ROUND', passengers: 1
  });
  assert.equal(flight.flightNumber, '7C 1302');
  assert.equal(flight.departureTime, '2026-10-11 18:00');
  const params = new URL(requestedUrl).searchParams;
  assert.equal(params.get('departure_id'), 'ICN');
  assert.equal(params.get('arrival_id'), 'FUK');
  assert.equal(params.get('return_date'), '2026-09-12');
  assert.equal(params.get('type'), '1');
  assert.equal(params.get('deep_search'), 'true');
  assert.equal(params.get('show_hidden'), 'true');
});

test('return options enforce the selected return departure time range', async () => {
  const provider = new SerpApiGoogleFlightsProvider({
    apiKey: 'test-key', testMode: false,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ other_flights: [
        {
          price: 240000,
          flights: [{
            airline: 'Jeju Air', flight_number: '7C 1616',
            departure_airport: { time: '2026-09-10 14:40' },
            arrival_airport: { time: '2026-09-10 16:20' }
          }]
        },
        {
          price: 260000,
          flights: [{
            airline: 'Jeju Air', flight_number: '7C 1602',
            departure_airport: { time: '2026-09-10 07:15' },
            arrival_airport: { time: '2026-09-10 09:00' }
          }]
        }
      ] })
    })
  });

  const flights = await provider.returnOptions('departure-token-123', {
    origin: 'ICN', destination: 'HIJ', departureDate: '2026-09-07',
    returnDate: '2026-09-10', tripType: 'ROUND', passengers: 1,
    returnTimes: '6,8'
  });

  assert.equal(flights.length, 1);
  assert.equal(flights[0].flightNumber, '7C 1602');
});

test('booking options pin the selected round-trip itinerary instead of relying on a token', async () => {
  let requestedUrl = '';
  const provider = new SerpApiGoogleFlightsProvider({
    apiKey: 'test-key', testMode: false,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => ({ booking_options: [] }) };
    }
  });
  const selectedFlights = {
    outbound: [{ flight_number: 'ZE607', departure_id: 'ICN', arrival_id: 'NRT', date: '2026-10-08' }],
    return: [{ flight_number: 'ZE608', departure_id: 'NRT', arrival_id: 'ICN', date: '2026-10-12' }]
  };

  await provider.bookingOptions({ bookingToken: 'stale-token', selectedFlights, query: { tripType: 'ROUND', passengers: 1 } });
  const params = new URL(requestedUrl).searchParams;
  assert.deepEqual(JSON.parse(params.get('selected_flights_json')), selectedFlights);
  assert.equal(params.get('booking_token'), null);
  assert.equal(params.get('type'), '1');
});
