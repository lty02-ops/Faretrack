function flightRoutes(controller){return[{method:'POST',pattern:/^\/api\/flights\/search$/,handler:req=>controller.search(req)},{method:'POST',pattern:/^\/api\/flights\/return-options$/,handler:req=>controller.returnOptions(req)},{method:'POST',pattern:/^\/api\/flights\/booking-options$/,handler:req=>controller.bookingOptions(req)}];}
module.exports = { flightRoutes };
