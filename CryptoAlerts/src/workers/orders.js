var request = require('request');
var db = require('./../database/db');
var helper = require('./../helpers/exchanges');
var IncomingWebhook = require('@slack/client').IncomingWebhook;
var bittrex = require('node.bittrex.api');
var poloniex = require('poloniex-api-node');
var alertsHelper = require('./../helpers/alerts');
var bot = require('./../bot/bot');

var notificationsWebhookURL = process.env.NOTIFICATIONS_WEBHOOK_URL || '';

var exchangeWebhook = new IncomingWebhook(notificationsWebhookURL);

function checkClosedOrders() {
  checkClosedOrdersBittrex();
  checkClosedOrdersPoloniex();
}

function checkClosedOrdersBittrex() {
  var exchanges = db.getCollection("exchanges");

  var bittrexRegistries = exchanges.chain().where(function(registry) {
    return registry.exchange == "bittrex"
  }).data();

  if (bittrexRegistries.length == 0)
    return;

  var processEachRegistryFunction = function(registry) {
    return function(orders) {
      if (orders == null)
        return;
      var ordersDescriptions = [];

      for (var i = 0; i < orders.length; i++) {
        var order = orders[i];

        var orderDate = Date.parse(order.Closed);

        if (!registry.hasOwnProperty("lastCheck") || orderDate < registry.lastCheck)
          continue;

        var baseCurrency = order.Exchange.split('-')[0];
        var currency = order.Exchange.split('-')[1];
        var orderType = order.OrderType == 'LIMIT_SELL' ? 'Sold' : 'Bought';
        var quantity = order.Quantity - order.QuantityRemaining;
        var price = order.PricePerUnit;
        var isConditional = order.IsConditional;

        var orderDescription = `${currency}: ${orderType} ${quantity} at ${price} ${baseCurrency}`;
        ordersDescriptions.push(orderDescription);

        setAlertsForExecutedOrder(registry.userid, registry.username, currency, price, orderType, 'bittrex', baseCurrency);
      }

      if (ordersDescriptions.length == 0)
        return;

      ordersDescriptions.sort();

      var responseMessage = '<@' + registry.userid + '|' + registry.username + '> Orders executed on bittrex:\n';
      for (var i in ordersDescriptions)
        responseMessage = responseMessage.concat(ordersDescriptions[i] + '\n');

      var messageJson = {
        text: responseMessage
      }

      try {
        bot.sendMessageToUser(registry.username, responseMessage);
        
        exchangeWebhook.send(messageJson, function(err, res) {
          if (err) {
            console.log('Error:', err);
          }
          else {
            console.log('Message sent: ', res);
          }
        });
        
        exchanges.updateWhere(
          function(r) {
            return r.username == registry.username && r.exchange == 'bittrex'
          },
          function(r) {
            r.lastCheck = Date.now();
            return r;
          }
        );
      }
      catch (err) {
        console.log('Error dispatching alert: ' + err.message);
      }
    };
  };

  for (var i = 0; i < bittrexRegistries.length; i++) {
    var registry = bittrexRegistries[i];
    helper.getOrderHistoryBittrex(null, registry.userid, processEachRegistryFunction(registry));
  }
}

function checkClosedOrdersPoloniex() {
  var exchanges = db.getCollection("exchanges");

  var poloniexRegistries = exchanges.chain().where(function(registry) {
    return registry.exchange == "poloniex"
  }).data();

  if (poloniexRegistries.length == 0)
    return;

  poloniexRegistries.forEach(function(registry) {
    var polo = new poloniex(registry.apikey, registry.apiSecret);

    var start = registry.lastCheck;
    var end = registry.lastCheck = new Date();

    // Dividing by 1000 converts the date to unix timestamp
    polo.returnMyTradeHistory("all", start / 1000, end / 1000, function(err, history) {
      if (!err) {
        exchanges.update(registry);

        var historyArray = [];

        for (var key in history) {
          if (history.hasOwnProperty(key) && history[key].length > 0) {
            // Order history is sent as arrays or orders indexed by the currency pair, but each order doesn't have the pair in itself, so we add it here
            history[key].forEach(function(order) {
              order.currencyPair = key
            });
            historyArray = historyArray.concat(history[key]);
          }
        }

        if (historyArray.length > 0) {
          var responseMessage = '<@' + registry.userid + '|' + registry.username + '> Orders executed on poloniex:\n';

          for (var i in historyArray) {
            var orderType = historyArray[i].type == 'sell' ? 'Sold' : 'Bought';
            var currency = historyArray[i].currencyPair.split('_')[0];
            var baseCurrency = historyArray[i].currencyPair.split('_')[1];
            var orderDescription = currency + ': ' + historyArray[i].type + ' ' + historyArray[i].amount + ' at ' + historyArray[i].rate;

            responseMessage = responseMessage.concat(orderDescription + '\n');

            setAlertsForExecutedOrder(registry.userid, registry.username, currency, historyArray[i].rate, orderType, 'poloniex', baseCurrency);
          }

          var messageJson = {
            text: responseMessage
          }
          
          bot.sendMessageToUser(registry.username, responseMessage);

          exchangeWebhook.send(messageJson, function(err, res) {
            if (err) {
              console.log('Error dispatching alert:', err);
            }
            else {
              console.log('Message sent: ', res);
            }
          });
        }
      }
    });
  });
}

function setAlertsForExecutedOrder(userId, username, currencyAcronym, price, orderType, exchange, baseCurrency) {

    var alerts = db.getCollection('alerts');

    // Remove old automated alerts
    alerts.chain().where(alert => alert.source === 'order' && alert.user === username && alert.acronym.toUpperCase() === currencyAcronym.toUpperCase()).remove();

    //10%
    var message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' went up 10% since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 1.1).toFixed(8), message, 'order', exchange, baseCurrency, null);

    message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' went down 10% since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 0.9).toFixed(8), message, 'order', exchange, baseCurrency, null);
    
     //20%
    message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' went up 20% since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 1.2).toFixed(8), message, 'order', exchange, baseCurrency, null);

    message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' went down 20% since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 0.8).toFixed(8), message, 'order', exchange, baseCurrency, null);
    
    //50%
    message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' went up 50% since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 1.5).toFixed(8), message, 'order', exchange, baseCurrency, null);

    //double/half
    message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' just doubled since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 2).toFixed(8), message, 'order', exchange, baseCurrency, null);

    message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' just halved since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 0.5).toFixed(8), message, 'order', exchange, baseCurrency, null);
    
    //1000%
    message = '<@' + userId + '|' + username + '> ' + currencyAcronym + ' went up 1000% since you ' + orderType.toLowerCase() + ` it at ${price} ${baseCurrency}.`;
    alertsHelper.setAlert(username, null, currencyAcronym, price, (price * 10).toFixed(8), message, 'order', exchange, baseCurrency, null);
}

module.exports = checkClosedOrders;
