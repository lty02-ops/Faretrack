class PriceHistoryRepository { constructor(){this.history=new Map();} save(point){const values=this.history.get(point.watchKey)||[];values.push(point);this.history.set(point.watchKey,values);return point;} listByWatchKey(key){return [...(this.history.get(key)||[])];} }
module.exports = { PriceHistoryRepository };
