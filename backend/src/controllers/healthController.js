class HealthController { constructor(mode){this.mode=mode;} get(){return{status:200,body:{status:'ok',mode:this.mode}};} }
module.exports = { HealthController };
