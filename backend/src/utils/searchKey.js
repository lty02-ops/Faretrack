function normalizeAirport(value) { return String(value || '').trim().toUpperCase(); }
function normalizeDate(value) { return String(value || '').replaceAll('-', ''); }
function createSearchKey(query) {
  const base = [normalizeAirport(query.origin), normalizeAirport(query.destination), normalizeDate(query.departureDate), query.tripType === 'ONE_WAY' ? '' : normalizeDate(query.returnDate), query.tripType || 'ROUND', Number(query.passengers || 1)].join('#');
  const filters = [query.outboundTimes, query.returnTimes, query.stops, query.maxPrice].map((value) => String(value || ''));
  return filters.some(Boolean) ? `${base}#F#${filters.join('#')}` : base;
}
module.exports = { createSearchKey, normalizeAirport, normalizeDate };
