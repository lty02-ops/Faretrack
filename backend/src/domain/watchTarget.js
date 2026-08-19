const crypto = require('node:crypto');
const { nowIso } = require('../utils/dateUtils');
function createWatchTarget(key, query) { return { id: `watch_${crypto.randomUUID().slice(0, 8)}`, key, query: { ...query }, active: true, createdAt: nowIso() }; }
module.exports = { createWatchTarget };
