class WatchRepository {
  constructor(){this.targets=new Map();this.alerts=new Map();}
  findTargetByKey(key){return this.targets.get(key)||null;} saveTarget(target){this.targets.set(target.key,target);return target;}
  saveAlert(alert){this.alerts.set(alert.id,alert);return alert;} findAlert(id){return this.alerts.get(id)||null;}
  listAlerts(userId){return [...this.alerts.values()].filter(alert=>!userId||alert.userId===userId);} updateAlert(id,patch){const alert=this.findAlert(id);if(!alert)return null;Object.assign(alert,patch);return alert;}
  deleteAlert(id){return this.alerts.delete(id);} listActiveTargets(){const keys=new Set(this.listAlerts().filter(a=>a.active).map(a=>a.watchKey));return [...keys].map(k=>this.findTargetByKey(k)).filter(Boolean);}
  alertsForTarget(key){return this.listAlerts().filter(a=>a.watchKey===key&&a.active);}
}
module.exports = { WatchRepository };
