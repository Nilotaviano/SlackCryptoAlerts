var loki = require('lokijs');


var db = new loki(process.env.DB_NAME, 
{
  autoload: true,
  autoloadCallback: function() {
      // if database did not exist it will be empty so I will intitialize here
      var alerts = db.getCollection('alerts');
      if (alerts == null) {
        alerts = db.addCollection('alerts');
      }
      alerts.chain().where(function(alert) { return alert.price == null || alert.currency == null || (alert.condition != '<' && alert.condition != '>') }).remove();
      
      var calls = db.getCollection('calls');
      if (calls == null) {
        calls = db.addCollection('calls');
      }

      var exchanges = db.getCollection('exchanges');
      if (exchanges == null) {
        exchanges = db.addCollection('exchanges');
      }
      exchanges.chain().where(function(registry) { return !registry.hasOwnProperty("userid") || registry.userid == null }).remove();
    },
  autosave: true, 
  autosaveInterval: 10000
}); 
     
     
module.exports = db;
