const crypto = require('node:crypto');
const { nowIso } = require('../utils/dateUtils');
function createUserAlert(target, settings) { return { id: `alert_${crypto.randomUUID().slice(0, 8)}`, userId: settings.userId || 'demo-user', email:settings.email || '', watchTargetId: target.id, watchKey: target.key, targetPrice: Number(settings.targetPrice), dropRatePercent: Number(settings.dropRatePercent || 10), active: true, createdAt: nowIso() }; }
module.exports = { createUserAlert };
