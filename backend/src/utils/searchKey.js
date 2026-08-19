function normalizeAirport(value) { return String(value || '').trim().toUpperCase(); }
function normalizeDate(value) { return String(value || '').replaceAll('-', ''); }
function createSearchKey(query) {
  return [normalizeAirport(query.origin), normalizeAirport(query.destination), normalizeDate(query.departureDate), query.tripType === 'ONE_WAY' ? '' : normalizeDate(query.returnDate), query.tripType || 'ROUND', Number(query.passengers || 1)].join('#');
}
module.exports = { createSearchKey, normalizeAirport, normalizeDate };
