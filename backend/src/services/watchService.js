const { createSearchKey } = require('../utils/searchKey');
const { createWatchTarget } = require('../domain/watchTarget');
const { createUserAlert } = require('../domain/userAlert');
class WatchService {
  constructor({watchRepository,priceHistoryRepository}){this.watches=watchRepository;this.history=priceHistoryRepository;}
  async create(query,settings={}){const key=createSearchKey(query);let target=await this.watches.findTargetByKey(key);if(!target){try{target=await this.watches.saveTarget(createWatchTarget(key,query));}catch(error){if(error.name!=='ConditionalCheckFailedException')throw error;target=await this.watches.findTargetByKey(key);}}const alert=await this.watches.saveAlert(createUserAlert(target,settings));return{target,alert};}
  async list(userId='demo-user'){const alerts=await this.watches.listAlerts(userId);return Promise.all(alerts.map(async alert=>({...alert,target:await this.watches.findTargetByKey(alert.watchKey),history:await this.history.listByWatchKey(alert.watchKey)})));}
  async update(id,userId,patch){const alert=await this.watches.findAlert(id);if(!alert||alert.userId!==userId)return null;const allowed={};for(const key of ['targetPrice','dropRatePercent','active'])if(Object.hasOwn(patch,key))allowed[key]=patch[key];return this.watches.updateAlert(id,allowed);}
  async remove(id,userId){const alert=await this.watches.findAlert(id);if(!alert||alert.userId!==userId)return false;return this.watches.deleteAlert(id);}
}
module.exports = { WatchService };
