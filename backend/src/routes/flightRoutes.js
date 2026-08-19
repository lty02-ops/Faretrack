function flightRoutes(controller){return[{method:'POST',pattern:/^\/api\/flights\/search$/,handler:req=>controller.search(req)}];}
module.exports = { flightRoutes };
