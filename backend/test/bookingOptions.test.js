const test = require('node:test');
const assert = require('node:assert/strict');
const { FlightSearchService } = require('../src/services/flightSearchService');
const { FlightSearchCache } = require('../src/cache/flightSearchCache');
const { FlightRepository } = require('../src/repositories/flightRepository');
const { mapBookingOptions } = require('../src/providers/serpApiGoogleFlightsProvider');

function service(provider, monthlyRequestLimit = 3) {
  return new FlightSearchService({ provider, cache: new FlightSearchCache(0), repository: new FlightRepository(), monthlyRequestLimit });
}

test('판매처 이동을 누른 예약 토큰만 조회하고 15분간 캐시한다', async () => {
  let calls = 0;
  const target = service({ bookingOptions: async () => { calls++; return [{ seller: 'Trip.com' }]; } });
  const request = { bookingToken: 'booking-token-123', departureToken: '' };
  assert.equal((await target.bookingOptions(request)).cached, false);
  assert.equal((await target.bookingOptions(request)).cached, true);
  assert.equal(calls, 1);
});

test('왕복 departure token 판매처 조회는 외부 호출 두 회로 계산한다', async () => {
  const target = service({ bookingOptions: async () => [] }, 1);
  await assert.rejects(() => target.bookingOptions({ bookingToken: '', departureToken: 'departure-token-123' }), /호출 한도/);
});

test('SerpApi 예약 옵션에서 실제 판매처와 POST 요청을 매핑한다', () => {
  const [option] = mapBookingOptions([{ separate_tickets: false, together: {
    book_with: 'Trip.com', price: 128000, airline_logos: ['https://example.com/logo.png'],
    booking_request: { url: 'https://www.google.com/travel/clk', post_data: 'u=opaque' }
  } }]);
  assert.equal(option.seller, 'Trip.com');
  assert.equal(option.price, 128000);
  assert.equal(option.postData, 'u=opaque');
});
