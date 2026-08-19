class FlightProvider { async search() { throw new Error('FlightProvider.search must be implemented'); } }
class DuffelProvider extends FlightProvider {}
class SkyscannerProvider extends FlightProvider {}
module.exports = { FlightProvider, DuffelProvider, SkyscannerProvider };
