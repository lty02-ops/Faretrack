class NotificationRepository { constructor(){this.items=[];this.keys=new Set();} exists(key){return this.keys.has(key);} save(item){if(this.exists(item.deduplicationKey))return null;this.keys.add(item.deduplicationKey);this.items.push(item);return item;} list(){return [...this.items];} }
module.exports = { NotificationRepository };
