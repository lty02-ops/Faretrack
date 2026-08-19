class FlightSearchCache {
  constructor(ttlMinutes = 60, clock = () => Date.now()) { this.ttlMs=ttlMinutes*60000; this.clock=clock; this.items=new Map(); }
  get(key) { const hit=this.items.get(key); if(!hit||this.clock()-hit.storedAt>this.ttlMs){this.items.delete(key);return null;} return hit.value; }
  set(key,value){this.items.set(key,{storedAt:this.clock(),value});}
  clear(){this.items.clear();}
}
module.exports = { FlightSearchCache };
