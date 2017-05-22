var request = require('request');
var db = require('./../database/db');
var helper = require('./../helpers/exchanges');
var IncomingWebhook = require('@slack/client').IncomingWebhook;

var exchangesWebhookURL = process.env.EXCHANGES_WEBHOOK_URL || '';

var exchangeWebhook = new IncomingWebhook(exchangesWebhookURL);

function checkClosedOrders()
{
  checkClosedOrdersBittrex();
}

function checkClosedOrdersBittrex()
{
  var exchanges = db.getCollection("exchanges");
  
  var x = exchanges.find();
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
      
      var responseMessage = '<@'+registry.userid+ '|' + registry.username +'> Some orders were executed:\n';
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

module.exports = checkClosedOrders;