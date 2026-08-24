const test = require('node:test');
const assert = require('node:assert/strict');
const { FlightSearchService } = require('../src/services/flightSearchService');
const { FlightSearchCache } = require('../src/cache/flightSearchCache');
const { FlightRepository } = require('../src/repositories/flightRepository');

test('selected outbound flight return options are fetched once and cached', async () => {
  let calls = 0;
  const service = new FlightSearchService({
    provider: { returnOptions: async () => { calls++; return [{ price: 210000, bookingToken: 'booking-token' }]; } },
    cache: new FlightSearchCache(0), repository: new FlightRepository(), monthlyRequestLimit: 3
  });
  const request = { departureToken: 'departure-token-123' };
  assert.equal((await service.returnOptions(request)).cached, false);
  assert.equal((await service.returnOptions(request)).cached, true);
  assert.equal(calls, 1);
});
