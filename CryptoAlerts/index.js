var express    = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var loki = require('lokijs');
var IncomingWebhook = require('@slack/client').IncomingWebhook;

var url = process.env.SLACK_WEBHOOK_URL || '';
var supportedExchanges = [ "bittrex" ];

var webhook = new IncomingWebhook(url);
var exchangeWebhook = new IncomingWebhook('https://hooks.slack.com/services/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');

var app = express();

var db = new loki(process.env.DB_NAME, 
{
  autoload: true,
  autoloadCallback: function() {
      // if database did not exist it will be empty so I will intitialize here
      var alerts = db.getCollection('alerts');
      if (alerts === null) {
        alerts = db.addCollection('alerts');
      }
      alerts.chain().where(function(alert) { return alert.price == null || alert.currency == null || (alert.condition != '<' && alert.condition != '>') }).remove();
      
      var calls = db.getCollection('calls');
      if (calls === null) {
        calls = db.addCollection('calls');
      }

      var exchanges = db.getCollection('exchanges');
      if (exchanges === null) {
        exchanges = db.addCollection('exchanges');
      }
      exchanges.chain().where(function(registry) { return !registry.hasOwnProperty("userid") || registry.userid === null }).remove();
    },
  autosave: true, 
  autosaveInterval: 10000
}); 
      
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.post("/exchanges/list", function(req, res) {
  var messageJson = 
    {
      //response_type: 'in_channel',
      text: 'The exchanges available for consult are ' + supportedExchanges.toString()
    };
    
  console.log('Message sent: ', messageJson);
  
  res.send(messageJson);
});

app.post("/exchanges/register", function(req, res) {
  var username = req.body.user_name;
  var userid = req.body.user_id;
  var splitText = req.body.text.split(" ");
  
  if(splitText.length != 3)
  {
    var messageJson = 
    {
      text: 'You should say the exchange you want to register, your api key and the api secret'
    };
    res.send(messageJson);
  }
  
  var exchangeName = splitText[0];
  
  if (supportedExchanges.indexOf(exchangeName) == -1)
  {
    var messageJson = 
    {
      text: 'The exchange ' + exchangeName + ' is not supported yet. The exchanges available are ' + supportedExchanges.toString()
    };
    res.send(messageJson);
  }
  
  var apiKey = splitText[1];
  var apiSecret = splitText[2];
  
  bittrexAPICall(res, userid, apiKey, apiSecret, 'market/getopenorders', 'market=BTC-LTC', function (error, response, body)
  {
    if(error || response.statusCode != 200)
    {
      var responseJson = JSON.parse(response.body);
      res.send('Error: ' + responseJson.error);
      console.log('Error: ', responseJson.error);
    }
    else
    {
      var exchanges = db.getCollection('exchanges');
      
      var query = exchanges.chain().where(function(registry) { return registry.userid === userid && registry.exchange == exchangeName});
      query.remove();
      
      exchanges.insert({ username: username, userid: userid, exchange: exchangeName, apikey: apiKey, apiSecret: apiSecret });
      
      var messageJson = "A chave de api foi registrada com sucesso";
      
      res.send(messageJson);
    }
  });
  
});

app.post('/exchanges/getopenorders', function(req, res) {
    var username = req.body.user_name;
    var userid = req.body.user_id;
    var exchangeName = req.body.text;
    
    if(exchangeName === 'bittrex')
      getOpenOrdersBittrex(res, username, userid);
});

app.post('/exchanges/getorderhistory', function(req, res) {
    var username = req.body.user_name;
    var exchangeName = req.body.text;
    
    if(exchangeName === 'bittrex')
      respondOrderHistoryBittrex(res, username);
});

function respondOrderHistoryBittrex(res, username)
{
  getOrderHistoryBittrex(res, username, function(orders)
  {
    var orders = [];
    for(var i = 0; i < orders.length; i++)
    {
      var openOrder = orders[i];
      var currency = openOrder.Exchange.split('-')[1];
      var orderType = openOrder.OrderType === 'LIMIT_SELL' ? 'Venda' : 'Compra';
      var quantity = openOrder.Quantity;
		  var price = openOrder.Limit;
		 
		  var orderDescription = currency + '|' + orderType + '|' + quantity + '|' + price;
		  
		  orders.push(orderDescription);
    }
    
    orders.sort();
    
    var responseMessage = 'All your order history is:\n';
    for(var i in orders)
		  responseMessage = responseMessage.concat(orders[i] + '\n');
    
    var messageJson = { 
      text: responseMessage
    }
    
    res.send(messageJson);
  });
}

function getOpenOrdersBittrex(res, username, userid)
{
  var apiRegistry = getAPIKey('bittrex', userid);
  
  if(apiRegistry === null)
  {
    var messageJson = { 
      text: "I wasn't able to find your apikey. Please register one to check your orders"
    };
    
    res.send(messageJson);
    return;
  }
  
  bittrexAPICall(res, userid, apiRegistry.apikey, apiRegistry.apiSecret, 'market/getopenorders', '', function (error, response, body)
  {
    if(error || response.statusCode != 200)
    {
      var responseJson = JSON.parse(response.body);
      res.send('Error: ' + responseJson.error);
      console.log('Error: ', responseJson.error);
    }
    else
    {
      var responseJson = JSON.parse(response.body);
      var orders = [];
      for(var i = 0; i < responseJson.result.length; i++)
      {
        var openOrder = responseJson.result[i];
        var currency = openOrder.Exchange.split('-')[1];
        var orderType = openOrder.OrderType === 'LIMIT_SELL' ? 'Sell' : 'Buy';
        var quantity = openOrder.QuantityRemaining;
			  var price = openOrder.Limit;
			  var isConditional = openOrder.IsConditional;
			 
			  var orderDescription = currency + ': ' + orderType + ' ' + quantity + ' at ' + price;
			  
			  if(openOrder.IsConditional)
			  {
  			  var condition = openOrder.Condition === 'GREATER_THAN' ? '>' : '<';
  			  var conditionTarget = openOrder.ConditionTarget;
  			  
  			  orderDescription = orderDescription.concat(' when ' + condition + ' ' + conditionTarget);
			  }
			  orders.push(orderDescription);
      }
      
      orders.sort();
      
      var responseMessage = 'Your open orders are:\n';
      for(var i in orders)
			  responseMessage = responseMessage.concat(orders[i] + '\n');
      
      var messageJson = { 
        text: responseMessage
      }
      
      res.send(messageJson);
    }
  });
}

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
    
  for(var i = 0; i < bittrexRegistries.length; i++)
  {
    var registry = bittrexRegistries[i];
    getOrderHistoryBittrex(null, registry.userid, function(orders)
    {
       var ordersDescriptions = [];
        for(var i = 0; i < orders.length; i++)
        {
          var order = orders[i];
          
          var orderDate = Date.parse(order.Closed);
          
          if(!registry.hasOwnProperty("lastCheck") || orderDate < registry.lastCheck)
            continue;
          
          var currency = order.Exchange.split('-')[1];
          var orderType = order.OrderType === 'LIMIT_SELL' ? 'Sold' : 'Bought';
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
            function(registry){ return registry.username === registry.username && registry.exchange === 'bittrex' }, 
            function(registry){ 
              registry.lastCheck = Date.now(); 
              return registry;
            }
          );
        }
        catch(err) {
          console.log('Error dispatching alert: ' + err.message);
        }
    });
  }
}

function getOrderHistoryBittrex(res, userid, ordersFunction)
{
  var apiRegistry = getAPIKey('bittrex', userid);
  
  if(apiRegistry === null)
  {
    if(res !== null)
    {
      var messageJson = { 
        text: "I wasn't able to find your apikey. Please register one to check your orders"
      };
      
      res.send(messageJson);
    }
    return;
  }
  
  bittrexAPICall(res, userid, apiRegistry.apikey, apiRegistry.apiSecret, 'account/getorderhistory', '', function (error, response, body)
  {
    var responseJson = JSON.parse(response.body);
    if(ordersFunction !== null)
      ordersFunction(responseJson.result);
  });
}

var jsSHA = require("jssha");
function bittrexAPICall(res, userid, apikey, apisecret, commandRoute, commandParameters, callback)
{
  var nonce=Date.now;
  var uri='https://bittrex.com/api/v1.1/'+commandRoute+'?apikey='+apikey+'&nonce='+nonce+(commandParameters !== '' ? '&'+commandParameters : '');
  var shaObj = new jsSHA("SHA-512", "TEXT");
  shaObj.setHMACKey(apisecret, "TEXT");
  shaObj.update(uri);
  var sign = shaObj.getHMAC("HEX");
  
  var options = {
            uri     : uri,
            agent   : false,
            method  : 'GET',
            headers : {
                "User-Agent": "Mozilla/4.0 (compatible; Node Bittrex API)",
                "Content-type": "application/x-www-form-urlencoded",
                "apisign": sign
            }
        };
  
  request(uri, options, function (error, response, body)
  {
    callback(error, response, body);
  });
}

function getAPIKey(exchangeName, userid)
{
  var exchanges = db.getCollection('exchanges');

  var query = exchanges.chain().where(function(exchange) { return exchange.userid === userid && exchange.exchange === exchangeName });
  var registries = query.data();
  
  if(registries.length == 0)
    return null;
  
  var bittrexRegistry = registries[0];
  return bittrexRegistry;
}

app.post("/alerts/new", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  
  if(splitText.length >= 2) {
    var currency = splitText[0];
    var alertPrice = splitText[1];
    var message = splitText.slice(2, splitText.length).join(" ");
    
    // Test if the coin exists on coinmarketcap
    request('https://api.coinmarketcap.com/v1/ticker/' + currency, function (error, response, body) {
      if(!error && response.statusCode == 200) {
        var responseJson = JSON.parse(response.body)[0];
        var currentPrice = responseJson.price_btc;
        var triggerCondition = alertPrice > currentPrice ? '>' : '<';
        
        var alerts = db.getCollection('alerts');
        
        alerts.insert( { currency : currency, user: username , price: alertPrice, condition: triggerCondition, message: message } );
  
        var messageJson = 
        {
          //response_type: 'in_channel',
          text: 'I will warn you when ' + currency + ' ' + triggerCondition + ' ' + alertPrice
        };
        
        console.log('Message sent: ', messageJson);
        
        res.send(messageJson);
      }
      else {
        var responseJson = JSON.parse(response.body);
        res.send('Error: ' + responseJson.error);
        console.log('Error: ', responseJson.error);
      }
    });
  }
  else {
    var messageJson = 
    {
      text: 'Unexpected format. Command format is "/alert coin price".'
    };
    
    console.log('Message sent: ', messageJson);
        
    res.send(messageJson);
  }
});

app.post("/delete", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  var entity = splitText[0];
  
  if(entity == 'alert' || entity == 'alerts') {
    var currency = splitText[1];
    var alertPrice = splitText[2];
    
    var alerts = db.getCollection('alerts');
  
    var query = alerts.chain().where(function(alert) { return alert.user === username });
    
    if(currency != 'all') {
      query = query.where(function(alert) { return alert.currency === currency });
      
      if(alertPrice != null)
        query = query.where(function(alert) { return alert.price === alertPrice });
    }
    
    var removedAlerts = query.data();
    
    if(removedAlerts.length > 0) {
      var responseMessage = 'Removed alerts:\n'
      
      for(var i = 0; i < removedAlerts.length ; i++) {
        responseMessage = responseMessage.concat('Currency: ', removedAlerts[i].currency, ', ', 'Price: ', removedAlerts[i].price, ', ', 'User: ', removedAlerts[i].user, ', ', 'Message: ', removedAlerts[i].message, '\n');
      }
      
      query.remove();
      
      var messageJson = 
      {
        response_type: 'in_channel',
        text: responseMessage
      };
          
      console.log('Message sent: ', messageJson);
      
      res.send(messageJson);
    }
    else {
      var message = 'No alerts found.';
      
      console.log('Message sent: ', message);
      
      res.send(message);
    }
  }
  else if(entity == 'call' || entity == 'calls') {
    var currency = splitText[1];
    var calls = db.getCollection('calls');
  
    var query = calls.chain().where(function(alert) { return alert.currency === currency });
    
    var removedCalls = query.data();
    
    if(removedCalls.length > 0) {
      var responseMessage = 'Removed calls:\n'
      
      for(var i = 0; i < removedCalls.length ; i++) {
        responseMessage = responseMessage.concat('Currency: ', removedCalls[i].currency, ', ', 'Target: ', removedCalls[i].target, '\n');
      }
      
      query.remove();
      
      var messageJson = 
      {
        response_type: 'in_channel',
        text: responseMessage
      };
          
      console.log('Message sent: ', messageJson);
      
      res.send(messageJson);
    }
    else {
      var message = 'No calls found.';
      
      console.log('Message sent: ', message);
      
      res.send(message);
    }
  }
});

app.post("/alerts", function (req, res) {
  var responseMessage = 'Alerts:\n'
  var alerts = db.getCollection('alerts');
  var allAlerts = alerts.find();
  
  for(var i = 0; i < allAlerts.length; i++) {
    responseMessage = responseMessage.concat('Currency: ', allAlerts[i].currency, ', ', 'Price: ', allAlerts[i].price, ', ', 'User: ', allAlerts[i].user, ', ', 'Message: ', allAlerts[i].message, '\n');
  }
  
  var messageJson = 
  {
    response_type: 'in_channel',
    text: responseMessage
  };
  
  console.log('Message sent: ', messageJson);
  
  res.send(messageJson);
});

app.post("/calls/new", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  
  if(splitText.length >= 2) {
    var currency = splitText[0];
    var calls = db.getCollection('calls');

    // Checa se já existe uma call para a moeda
    var existsCallForCurrency = calls.chain().where(function(call) { return call.currency === currency }).data().length > 0;
    
    if(!existsCallForCurrency) {
      var target = splitText[1];
      var message = splitText.slice(2, splitText.length).join(" ");
      
      request('https://api.coinmarketcap.com/v1/ticker/' + currency, function (error, response, body) {
        if(!error && response.statusCode == 200) {
          var responseJson = JSON.parse(response.body)[0];
          var currentPrice = responseJson.price_btc;

          calls.insert( { currency : currency, user: username , target: target, message: message, original_price: currentPrice } );
    
          var messageJson = 
          {
            response_type: 'in_channel',
            text: '<!channel> new call for ' + currency + ' with ' + target + ' target.'
          };
          
          console.log('Message sent: ', messageJson);
          
          res.send(messageJson);
        }
        else {
          var responseJson = JSON.parse(response.body);
          res.send('Error: ' + responseJson.error);
          console.log('Error: ', responseJson.error);
        }
      });
    }
    else {
      var messageJson = 
      {
        text: 'There already is a call for ' + currency + '. Remove it before adding another.'
      };
      
      console.log('Message sent: ', messageJson);
          
      res.send(messageJson);
    }
  }
  else {
    var messageJson = 
    {
      text: 'Unexpected format. Command format is "/call coin target".'
    };
    
    console.log('Message sent: ', messageJson);
        
    res.send(messageJson);
  }
});

app.post("/calls", function (req, res) {
  var responseMessage = ''
  var calls = db.getCollection('calls');
  var allCalls = calls.find();
  
  for(var i = 0; i < allCalls.length; i++) {
    responseMessage = responseMessage.concat('Currency: ', allCalls[i].currency, ', ', 'Target: ', allCalls[i].target, ', ', 'User: ', allCalls[i].user, ', ', 'Original price: ', allCalls[i].original_price, '\n');
  }
  
  var messageJson = 
  {
    response_type: 'in_channel',
    text: responseMessage
  };
  
  console.log('Message sent: ', messageJson);
  
  res.send(messageJson);
});

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
          var messageToSend = '<!channel> triggered alert: ' + allAlerts[i].currency + ' at price ' + ticker.price_btc + '. Message: ' + ticker.message;
          
          try {
            webhook.send(messageToSend, function(err, res) {
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

app.post("/currency", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  var currency = splitText[0];
  var convert = 'BTC';
  
  if(currency == '')
    currency = 'Bitcoin';
    
  if(splitText.length > 1)
    convert = splitText[1];
  else if(currency == 'Bitcoin')
    convert = 'USD';
  
  request('https://api.coinmarketcap.com/v1/ticker/' + currency + '/?convert=' + convert, function (error, response, body) {
      if(!error && response.statusCode == 200) {
        var responseJson = JSON.parse(response.body)[0];
        var currentPrice = parseFloat(responseJson["price_"+convert.toLowerCase()]).toFixed(8);
        var currencyName = responseJson.name;
        var currencySymbol = responseJson.symbol;
        
        var messageJson = 
        {
          response_type: 'in_channel',
          text: currencyName + ' (' + currencySymbol + ')' + ': ' + currentPrice + ' ' + convert
        };
        
        console.log('Message sent: ', messageJson);
        
        res.send(messageJson);
      }
      else {
        var responseJson = JSON.parse(response.body);
        res.send('Error: ' + responseJson.error);
        console.log('Error: ', responseJson.error);
      }
    });
});

app.listen(parseInt(process.env.PORT), function (err) {
  if (err) {
    throw err
  }
  
  console.log('Server started on port ' + process.env.PORT);
  
  setInterval(checkTriggeredAlerts,10000);
  setInterval(checkClosedOrders,10000);
})
