const { createSearchKey } = require('../utils/searchKey');
const { createWatchTarget } = require('../domain/watchTarget');
const { createUserAlert } = require('../domain/userAlert');
const { createPriceHistory } = require('../domain/priceHistory');
const crypto = require('node:crypto');
class WatchService {
  constructor({watchRepository,priceHistoryRepository}){this.watches=watchRepository;this.history=priceHistoryRepository;}
  async create(query,settings={}){const key=createSearchKey(query);let target=await this.watches.findTargetByKey(key);if(!target){try{target=await this.watches.saveTarget(createWatchTarget(key,query));}catch(error){if(error.name!=='ConditionalCheckFailedException')throw error;target=await this.watches.findTargetByKey(key);}}const alert=await this.watches.saveAlert(createUserAlert(target,settings));const history=await this.history.listByWatchKey(key);if(history.length===0&&Number(settings.baselinePrice)>0)await this.history.save(createPriceHistory(key,settings.baselinePrice));return{target,alert};}
  async list(userId='demo-user'){const alerts=await this.watches.listAlerts(userId);return Promise.all(alerts.map(async alert=>{const history=await this.history.listByWatchKey(alert.watchKey);const displayHistory=history.length>0||Number(alert.baselinePrice)<=0?history:[{id:`baseline_${alert.id}`,watchKey:alert.watchKey,price:Number(alert.baselinePrice),provider:'REGISTRATION',checkedAt:alert.createdAt}];return{...alert,target:await this.watches.findTargetByKey(alert.watchKey),history:displayHistory};}));}
  async update(id,userId,patch){const alert=await this.watches.findAlert(id);if(!alert||alert.userId!==userId)return null;const allowed={};for(const key of ['targetPrice','dropRatePercent','active'])if(Object.hasOwn(patch,key))allowed[key]=patch[key];return this.watches.updateAlert(id,allowed);}
  async remove(id,userId){const alert=await this.watches.findAlert(id);if(!alert||alert.userId!==userId)return false;return this.watches.deleteAlert(id);}
  async registerDevice(userId,{token,platform='ANDROID'}){if(!userId||!token)throw new Error('사용자와 기기 토큰이 필요합니다.');const device={id:crypto.createHash('sha256').update(token).digest('hex').slice(0,32),userId,token,platform,updatedAt:new Date().toISOString()};return this.watches.saveDevice(userId,device);}
}
module.exports = { WatchService };
