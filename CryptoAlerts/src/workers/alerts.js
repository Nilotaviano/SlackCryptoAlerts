var request = require('request');
var db = require('./../database/db');
var IncomingWebhook = require('@slack/client').IncomingWebhook;
var bot = require('./../bot/bot');
var async = require('async');
var bittrex = require('node.bittrex.api');
var poloniex = require('poloniex-api-node');

var alertsWebhookUrl = process.env.ALERTS_WEBHOOK_URL || '';

var alertsWebhook = new IncomingWebhook(alertsWebhookUrl);

var compareFunctions = {
  '>': function(currentPrice, alertPrice) {
    return currentPrice >= alertPrice
  },
  '<': function(currentPrice, alertPrice) {
    return currentPrice <= alertPrice
  }
};

function checkTriggeredAlerts() {
  var calls = []

  calls.push((callback) => {
    bittrex.getmarketsummaries(function(response) {
      if (response.success) {

        var markets = [];

        for (var i in response.result) {
          if (response.result[i].MarketName.startsWith('BTC-')) {
            var market = {
              acronym: response.result[i].MarketName.substring(4),
              price: response.result[i].Last,
              source: 'bittrex'
            };
            markets.push(market);
          }
        }

        callback(null, {
          source: 'bittrex',
          markets: markets
        });
      }
      else {
        callback(response.message, null);
      }
    })
  });

  calls.push((callback) => {
    request('https://api.coinmarketcap.com/v1/ticker/', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var responseJson = JSON.parse(response.body);
        var markets = [];

        for (var i in responseJson) {
          var market = {
            currency: responseJson[i].id,
            acronym: responseJson[i].symbol,
            price: responseJson[i].price_btc,
            source: 'coinmarketcap'
          };
          markets.push(market);
        }

        callback(null, {
          source: 'coinmarketcap',
          markets: markets
        });
      }
      else {
        callback(error, null);
      }
    })
  });

  try {
    async.parallel(calls, function(err, result) {
      if (!err && result.length > 0 && result.some(function(r) {
          return r != null;
        })) {

        var bittrexMarkets = result.find(r => r.source == 'bittrex').markets
        var coinmarketcapMarkets = result.find(r => r.source == 'coinmarketcap').markets

        var alerts = db.getCollection('alerts');
        var allAlerts = alerts.find();
        var acronyms = db.getCollection('acronyms');

        for (var i in allAlerts) {
          var market = null;

          // Temporary
          if (allAlerts[i].acronym == null) {
            var acronym = acronyms.find({
              'name': allAlerts[i].currency.toLowerCase()
            })[0];
            
            if(acronym != null)
              allAlerts[i].acronym = acronym.acronym;
          }

          if (bittrexMarkets.some(m => m.acronym == allAlerts[i].acronym)) {
            market = bittrexMarkets.find(m => m.acronym == allAlerts[i].acronym);
          }
          else {
            market = coinmarketcapMarkets.find(m => m.currency == allAlerts[i].currency);
          }

          if (market != null && compareFunctions[allAlerts[i].condition](market.price, allAlerts[i].price)) {
            var messageToSend = 'Triggered alert on ' + market.source + ': ' + allAlerts[i].currency + ' at price ' + market.price + '(was ' + allAlerts[i].price.toFixed(8) + ').';

            if (allAlerts[i].message != null)
              messageToSend += ' Message: ' + allAlerts[i].message;

            try {
              bot.sendMessageToUser(allAlerts[i].user, messageToSend);

              alertsWebhook.send(messageToSend, function(err, res) {
                if (err) {
                  console.log('Error:', err);
                }
                else {
                  console.log('Message sent: ', res);
                }
              });

              alerts.remove(allAlerts[i]);
            }
            catch (err) {
              console.log('Error dispatching alert: ' + err.message);
            }
          }

        }
      }
    });
  }
  catch (err) {
    console.log('Error checking alerts: ' + err.message);
  }
}

module.exports = checkTriggeredAlerts;
