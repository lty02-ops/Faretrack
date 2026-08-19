const crypto = require('node:crypto');
const { nowIso } = require('../utils/dateUtils');
function createPriceHistory(watchKey, price, provider = 'SERPAPI_GOOGLE_FLIGHTS') { return { id: `price_${crypto.randomUUID().slice(0, 8)}`, watchKey, price: Number(price), provider, checkedAt: nowIso() }; }
module.exports = { createPriceHistory };
