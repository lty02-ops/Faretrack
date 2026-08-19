function validateFlightSearch(query) {
  for (const field of ['origin', 'destination', 'departureDate', 'tripType', 'passengers']) if (!query[field]) throw new Error(`${field} 값이 필요합니다.`);
  if (query.tripType === 'ROUND' && !query.returnDate) throw new Error('왕복 여정에는 귀국일이 필요합니다.');
  if (query.origin.trim().toUpperCase() === query.destination.trim().toUpperCase()) throw new Error('출발지와 도착지는 달라야 합니다.');
}
module.exports = { validateFlightSearch };
