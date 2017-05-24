var request = require('request');
var db = require('./../database/db');
var helper = require('./../helpers/exchanges');
var IncomingWebhook = require('@slack/client').IncomingWebhook;
var bittrex = require('node.bittrex.api');
var poloniex = require('poloniex-api-node');

var exchangesWebhookURL = process.env.EXCHANGES_WEBHOOK_URL || '';

var exchangeWebhook = new IncomingWebhook(exchangesWebhookURL);

function checkClosedOrders()
{
  checkClosedOrdersBittrex();
  checkClosedOrdersPoloniex();
}

function checkClosedOrdersBittrex()
{
  var exchanges = db.getCollection("exchanges");
  
  var bittrexRegistries = exchanges.chain().where(function(registry) { return registry.exchange == "bittrex"}).data();
  
  if(bittrexRegistries.length == 0)
    return;
    
  var processEachRegistryFunction = function(registry)
  {
    return function(orders)
    {
      if(orders == null)
          return;
      var ordersDescriptions = [];
      
      for(var i = 0; i < orders.length; i++)
      {
        var order = orders[i];
        
        var orderDate = Date.parse(order.Closed);
        
        if(!registry.hasOwnProperty("lastCheck") || orderDate < registry.lastCheck)
          continue;
        
        var currency = order.Exchange.split('-')[1];
        var orderType = order.OrderType == 'LIMIT_SELL' ? 'Sold' : 'Bought';
        var quantity = order.Quantity;
  		  var price = order.PricePerUnit;
  		  var isConditional = order.IsConditional;
  		 
  		  var orderDescription = currency + ': ' + orderType + ' ' + quantity + ' at ' + price;
  		  ordersDescriptions.push(orderDescription);
      }
      
      if(ordersDescriptions.length == 0)
        return;
      
      ordersDescriptions.sort();
      
      var responseMessage = '<@'+registry.userid+ '|' + registry.username +'> Orders executed on bittrex:\n';
      for(var i in ordersDescriptions)
  		  responseMessage = responseMessage.concat(ordersDescriptions[i] + '\n');
      
      var messageJson = {
        text: responseMessage,
        channel: '@'+ registry.userid
      }
      
      try 
      {
        exchangeWebhook.send(messageJson, function(err, res) {
            if (err) {
              console.log('Error:', err);
            } else {
              console.log('Message sent: ', res);
            }
        });
        
        exchanges.updateWhere(
          function(registry){ return registry.username == registry.username && registry.exchange == 'bittrex' }, 
          function(registry){ 
            registry.lastCheck = Date.now(); 
            return registry;
          }
        );
      }
      catch(err) {
        console.log('Error dispatching alert: ' + err.message);
      }
    };
  };
    
  for(var i = 0; i < bittrexRegistries.length; i++)
  {
    var registry = bittrexRegistries[i];
    helper.getOrderHistoryBittrex(null, registry.userid, processEachRegistryFunction(registry));
  }
}

function checkClosedOrdersPoloniex()
{
  var exchanges = db.getCollection("exchanges");
  
  var poloniexRegistries = exchanges.chain().where(function(registry) { return registry.exchange == "poloniex"}).data();
  
  if(poloniexRegistries.length == 0)
    return;
    
  poloniexRegistries.forEach(function(registry)
  {
    var polo = new poloniex(registry.apikey, registry.apiSecret);
    
    var start = registry.lastCheck;
    var end = registry.lastCheck = new Date();

    // Dividing by 1000 converts the date to unix timestamp
    polo.returnMyTradeHistory("all", start/1000, end/1000, function (err, history) {
      if (!err) {
        exchanges.update(registry);
        
        var historyArray = [];
        
        for (var key in history) {
            if (history.hasOwnProperty(key) && history[key].length > 0) {
              // Order history is sent as arrays or orders indexed by the currency pair, but each order doesn't have the pair in itself, so we add it here
              history[key].forEach(function(order) { order.currencyPair = key });
              historyArray = historyArray.concat(history[key]);
            }
          }
        
        if(historyArray.length > 0) {
          var responseMessage = '<@'+registry.userid+ '|' + registry.username +'> Orders executed on poloniex:\n';
  
          for(var i in historyArray)
          {
        	  var orderDescription = historyArray[i].currencyPair + ': ' + historyArray[i].type + ' ' + historyArray[i].amount + ' at ' + historyArray[i].rate;
		        responseMessage = responseMessage.concat(orderDescription + '\n');
          }
          
          var messageJson = {
            text: responseMessage,
            channel: '@'+ registry.userid
          }
          
          exchangeWebhook.send(messageJson, function(err, res) {
              if (err) {
                console.log('Error dispatching alert:', err);
              } else {
                console.log('Message sent: ', res);
              }
          });
        }
      }
    });
  });
}

module.exports = checkClosedOrders;