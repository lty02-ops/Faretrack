class WatchController {
  constructor({watchService,priceCheckService,priceHistoryRepository}){Object.assign(this,{watchService,priceCheckService,priceHistoryRepository});}
  async create({body,userId,email}){const created=await this.watchService.create(body.query,{...body,userId:userId||body.userId,email:email||body.email});return{status:201,body:created};}
  async list({userId}={}){return{status:200,body:await this.watchService.list(userId)};}
  async update({params,body,userId}){const result=await this.watchService.update(params.id,userId,body);return{status:result?200:404,body:result||{error:'Not found'}};}
  async remove({params,userId}){const removed=await this.watchService.remove(params.id,userId);return{status:removed?204:404,body:removed?null:{error:'Not found'}};}
  async history({params}){return{status:200,body:await this.priceHistoryRepository.listByWatchKey(params.watchKey)};}
  async checkPrices(){return{status:200,body:await this.priceCheckService.checkActiveTargets()};}
}
module.exports = { WatchController };
