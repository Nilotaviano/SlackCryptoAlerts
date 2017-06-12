var request = require('request');
var db = require('./../database/db');
var IncomingWebhook = require('@slack/client').IncomingWebhook;
var bot = require('./../bot/bot');

var alertsWebhookUrl = process.env.ALERTS_WEBHOOK_URL || '';

var alertsWebhook = new IncomingWebhook(alertsWebhookUrl);

var compareFunctions = {
    '>': function (currentPrice, alertPrice) { return currentPrice >= alertPrice },
    '<': function (currentPrice, alertPrice) { return currentPrice <= alertPrice }
};

function checkTriggeredAlerts() {
  request('https://api.coinmarketcap.com/v1/ticker/', function (error, response, body) {
    if(!error && response.statusCode == 200) {
      var responseJson = JSON.parse(response.body);
      var alerts = db.getCollection('alerts');
      var allAlerts = alerts.find();
      
      for(var i = 0; i < allAlerts.length; i++) {
        var ticker = responseJson.find(item => { return item.id == allAlerts[i].currency })
        
        if(ticker != null && compareFunctions[allAlerts[i].condition](ticker.price_btc, allAlerts[i].price)) {
          var messageToSend = 'Triggered alert: ' + allAlerts[i].currency + ' at price ' + ticker.price_btc + '. Message: ' +  allAlerts[i].message;
          
          try {
            bot.sendMessageToUser(allAlerts[i].user, messageToSend);
            
            alertsWebhook.send(messageToSend, function(err, res) {
                if (err) {
                  console.log('Error:', err);
                } else {
                  console.log('Message sent: ', res);
                }
            });
            
            alerts.remove(allAlerts[i]);
          }
          catch(err) {
            console.log('Error dispatching alert: ' + err.message);
          }
        }
      }
    }
  });
}

module.exports = checkTriggeredAlerts;
