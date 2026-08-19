function healthRoutes(controller){return[{method:'GET',pattern:/^\/api\/health$/,handler:req=>controller.get(req)}];}
module.exports = { healthRoutes };
