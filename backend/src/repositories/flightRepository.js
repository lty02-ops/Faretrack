class FlightRepository { constructor(){this.searches=[];} save(search){this.searches.push(search);return search;} count(){return this.searches.length;} }
module.exports = { FlightRepository };
