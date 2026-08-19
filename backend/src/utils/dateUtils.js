const nowIso = () => new Date().toISOString();
const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
module.exports = { nowIso, monthKey };
