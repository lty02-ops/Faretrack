function watchRoutes(controller){return[
 {method:'POST',pattern:/^\/api\/alerts$/,handler:req=>controller.create(req)},
 {method:'GET',pattern:/^\/api\/alerts$/,handler:req=>controller.list(req)},
 {method:'PATCH',pattern:/^\/api\/alerts\/(?<id>[^/]+)$/,handler:req=>controller.update(req)},
 {method:'DELETE',pattern:/^\/api\/alerts\/(?<id>[^/]+)$/,handler:req=>controller.remove(req)},
 {method:'GET',pattern:/^\/api\/history\/(?<watchKey>.+)$/,handler:req=>controller.history(req)},
 {method:'POST',pattern:/^\/internal\/price-check$/,handler:req=>controller.checkPrices(req)}
];}
module.exports = { watchRoutes };
