const crypto = require('node:crypto');
const { nowIso } = require('../utils/dateUtils');
function createNotification(alert, pricePoint, reasons, status = 'QUEUED_TEST', channel = 'PUSH') { return { id: `notice_${crypto.randomUUID().slice(0, 8)}`, deduplicationKey: `${alert.id}#${pricePoint.id}#${reasons.join(',')}`, alertId: alert.id, priceHistoryId: pricePoint.id, reasons, channel, status, createdAt: nowIso() }; }
module.exports = { createNotification };
