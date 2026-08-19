class FlightController { constructor(service){this.service=service;} async search({body}){return{status:200,body:await this.service.search(body)};} }
module.exports = { FlightController };
