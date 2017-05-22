var alerts = require('./alerts');
var orders = require('./orders');

function initialize() {
  setInterval(alerts, 10000);
  setInterval(orders, 10000);
}

module.exports = {
  initialize: initialize
};