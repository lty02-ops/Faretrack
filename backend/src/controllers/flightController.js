class FlightController { constructor(service){this.service=service;} async search({body}){return{status:200,body:await this.service.search(body)};} async bookingOptions({body}){return{status:200,body:await this.service.bookingOptions(body)};} async returnOptions({body}){return{status:200,body:await this.service.returnOptions(body)};} }
module.exports = { FlightController };
