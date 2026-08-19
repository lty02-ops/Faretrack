const findLowestPrice = flights => Math.min(...flights.map(flight => Number(flight.price)));
const calculateDropRate = (previous, current) => previous ? ((previous - current) / previous) * 100 : 0;
const averagePrice = history => history.length ? Math.round(history.reduce((sum, item) => sum + item.price, 0) / history.length) : null;
module.exports = { findLowestPrice, calculateDropRate, averagePrice };
