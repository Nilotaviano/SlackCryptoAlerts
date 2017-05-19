var express    = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var request = require('request');
var loki = require('lokijs');
var IncomingWebhook = require('@slack/client').IncomingWebhook;

var url = process.env.SLACK_WEBHOOK_URL || '';

var webhook = new IncomingWebhook(url);

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
    },
  autosave: true, 
  autosaveInterval: 10000
}); 
      
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

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

app.post("/alerts/delete", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  var currency = splitText[0];
  var alertPrice = splitText[1];
  
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

// Tell our app to listen on port 8080
app.listen(process.env.PORT, function (err) {
  if (err) {
    throw err
  }
  
  console.log('Server started on port 8080');
  
  setInterval(checkTriggeredAlerts,10000);
})
