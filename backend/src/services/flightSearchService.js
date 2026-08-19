const { validateFlightSearch } = require('../domain/flight');
const { createSearchKey } = require('../utils/searchKey');
const { nowIso, monthKey } = require('../utils/dateUtils');
class FlightSearchService {
  constructor({provider,cache,repository,monthlyRequestLimit=200}){this.provider=provider;this.cache=cache;this.repository=repository;this.limit=monthlyRequestLimit;this.usage=new Map();}
  async search(query,{bypassCache=false}={}){validateFlightSearch(query);const key=createSearchKey(query);const cached=!bypassCache&&this.cache.get(key);if(cached)return{key,flights:cached,cached:true};const month=monthKey(),used=this.usage.get(month)||0;if(used>=this.limit)throw new Error('월간 외부 API 호출 한도에 도달했습니다.');const flights=await this.provider.search(query);this.usage.set(month,used+1);this.cache.set(key,flights);await this.repository.save({key,query,requestedAt:nowIso(),flightCount:flights.length});return{key,flights,cached:false};}
}
module.exports = { FlightSearchService };
