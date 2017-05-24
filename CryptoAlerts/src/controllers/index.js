var request = require('request');
var db = require('./../database/db');
var express = require('express');
var router = express.Router();
var async = require('async');
var bittrex = require('node.bittrex.api');
var poloniex = require('poloniex-api-node');

bittrex.options({
    'stream' : false,
    'verbose' : true,
    'cleartext' : false 
});

router.use('/alerts', require('./alerts'));
router.use('/calls', require('./calls'));
router.use('/exchanges', require('./exchanges'));

router.post("/delete", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  var entity = splitText[0];
  
  if(entity == 'alert' || entity == 'alerts') {
    var currency = splitText[1];
    var alertPrice = splitText[2];
    
    var alerts = db.getCollection('alerts');
  
    var query = alerts.chain().where(function(alert) { return alert.user == username });
    
    if(currency != 'all') {
      query = query.where(function(alert) { return alert.currency == currency });
      
      if(alertPrice != null)
        query = query.where(function(alert) { return alert.price == alertPrice });
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
  else if(entity == 'register')
  {
    var userid = req.body.user_id;
    
    var exchanges = db.getCollection('exchanges');
    var query = exchanges.chain().where(function(registry) { return registry.userid == userid;});
    query.remove();
    
    var messageJson = 
    {
      text: "Your exchange integration registry has been removed"
    }
    
    console.log('Message sent: ', messageJson);
    
    res.send(messageJson);
  }
  else if(entity == 'call' || entity == 'calls') {
    var currency = splitText[1];
    var calls = db.getCollection('calls');
  
    var query = calls.chain().where(function(alert) { return alert.currency == currency });
    
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
  else {
    var message = 'Unrecognized command.';
    
    console.log('Message sent: ', message);
    
    res.send(message);
  }
});

router.post("/currency", function (req, res) {
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

router.post("/price", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  var currency = splitText[0].toUpperCase();
  var prices = [];
  var calls = []
  
  calls.push(function(callback) {
    bittrex.getticker( { market : "BTC-"+currency }, function(ticker) {
      if(ticker.success) {
        var price = { exchange: 'Bittrex', bid: ticker.result.Bid, ask: ticker.result.Ask, last: ticker.result.Last };
        callback(null, price);
      }
      else {
        callback(null, null);
      }
    })
  });

  calls.push(function(callback) {
    var polo = new poloniex();
    polo.returnTicker(function (err, ticker) {
      if (!err) {
        for (var key in ticker) {
          if (ticker.hasOwnProperty(key) && key == "BTC_"+currency) {
            var price = { exchange: 'Poloniex', bid: ticker[key].highestBid, ask: ticker[key].lowestAsk, last: ticker[key].last };
            callback(null, price);
            return;
          }
        }
      }
      
      callback(null, null);
    })
  });
  
  async.parallel(calls, function(err, result) {
    if(!err && result.length > 0 && result.some(function (r) { return r != null; })) {
      var message = ""

      for(var i in result) 
      {
        if(result[i] != null) {
          message = message.concat(result[i].exchange + ": " + currency + "\n");
          message = message.concat("Bid: " + result[i].bid.toFixed(8) + " BTC\n");
          message = message.concat("Ask: " + result[i].ask.toFixed(8) + " BTC\n");
          message = message.concat("Last: " + result[i].last.toFixed(8) + " BTC\n");
          message = message.concat("\n");
        }
      }
      
      var messageJson = 
      {
        response_type: 'in_channel',
        text: message
      };
      
      console.log('Message sent: ', messageJson);
      
      res.send(messageJson);
    }
    else {
      var message = 'Currency not found.';
      
      console.log('Message sent: ', message);
      
      res.send(message);
    }
  });
  
  /*
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
    */
});

module.exports = router