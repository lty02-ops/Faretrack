const crypto = require('node:crypto');
const { FlightProvider } = require('./flightProvider');
class SerpApiGoogleFlightsProvider extends FlightProvider {
  constructor({ apiKey = '', fetchImpl = fetch, testMode = true } = {}) { super(); this.apiKey = apiKey; this.fetch = fetchImpl; this.testMode = testMode; }
  async search(query) {
    if (this.testMode || !this.apiKey) return createMockFlights(query);
    const params = new URLSearchParams({ engine:'google_flights', departure_id:query.origin, arrival_id:query.destination, outbound_date:query.departureDate, currency:'KRW', hl:'ko', api_key:this.apiKey, adults:String(query.passengers || 1), type:query.tripType === 'ONE_WAY' ? '2' : '1' });
    if (query.tripType !== 'ONE_WAY') params.set('return_date', query.returnDate);
    const response = await this.fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) throw new Error(`SerpApi 호출 실패 (${response.status})`);
    const data = await response.json();
    return [...(data.best_flights || []), ...(data.other_flights || [])].map(mapFlight).slice(0, 12);
  }
}
function mapFlight(item) { const first=item.flights?.[0]||{}, last=item.flights?.at(-1)||first; return { id:`flight_${crypto.randomUUID().slice(0,8)}`, airline:first.airline||'항공사', flightNumber:first.flight_number||'-', departureTime:first.departure_airport?.time||'-', arrivalTime:last.arrival_airport?.time||'-', stops:Math.max(0,(item.flights?.length||1)-1), price:Number(item.price||0), seller:'Google Flights', bookingUrl:item.booking_token?`https://www.google.com/travel/flights?booking_token=${encodeURIComponent(item.booking_token)}`:'https://www.google.com/travel/flights' }; }
function createMockFlights(query) { const seed=[...query.origin,...query.destination].reduce((sum,c)=>sum+c.charCodeAt(0),0), base=128000+(seed%7)*9000; return [['대한항공','KE703','09:55','12:20',0,base,'Google Flights'],['아시아나항공','OZ102','10:50','13:15',0,base+17400,'트립닷컴'],['제주항공','7C1102','08:10','10:35',0,base+6200,'Google Flights'],['진에어','LJ203','15:20','17:45',1,base-5800,'카약']].map(([airline,flightNumber,departureTime,arrivalTime,stops,price,seller])=>({id:`flight_${crypto.randomUUID().slice(0,8)}`,airline,flightNumber,departureTime,arrivalTime,stops,price,seller,bookingUrl:'https://www.google.com/travel/flights'})); }
module.exports = { SerpApiGoogleFlightsProvider, createMockFlights };
