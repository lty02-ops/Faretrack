const { findLowestPrice } = require('../utils/priceUtils');
const { createPriceHistory } = require('../domain/priceHistory');
class PriceCheckService {
  constructor({watchRepository,priceHistoryRepository,flightSearchService,priceComparisonService,notificationService,enabled=true}){Object.assign(this,{watches:watchRepository,history:priceHistoryRepository,search:flightSearchService,comparison:priceComparisonService,notifications:notificationService,enabled});}
  async checkActiveTargets(){if(!this.enabled)return{checkedTargets:0,notifications:0,disabled:true};const targets=await this.watches.listActiveTargets();let notificationCount=0;for(const target of targets){const result=await this.search.search(target.query,{bypassCache:true});const point=await this.history.save(createPriceHistory(target.key,findLowestPrice(result.flights)));const history=await this.history.listByWatchKey(target.key);const alerts=await this.watches.alertsForTarget(target.key);for(const alert of alerts){const comparison=this.comparison.compare(point,history,alert);if(comparison.shouldNotify&&await this.notifications.send(alert,point,comparison.reasons))notificationCount++;}}return{checkedTargets:targets.length,notifications:notificationCount,disabled:false};}
}
module.exports = { PriceCheckService };
