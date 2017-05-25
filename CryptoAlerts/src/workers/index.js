var alerts = require('./alerts');
var orders = require('./orders');
var acronymsMappingUpdater = require('./acronymsMappingUpdater');

function initialize() {
  setInterval(alerts, 10000);
  setInterval(orders, 10000);
  setInterval(acronymsMappingUpdater, 3600000);
}

module.exports = {
  initialize: initialize
};