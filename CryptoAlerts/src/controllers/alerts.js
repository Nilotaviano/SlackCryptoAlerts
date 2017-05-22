var express = require('express');
var router = express.Router();

var request = require('request');
var db = require('./../database/db');

router.post("/new", function (req, res) {
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

router.post("/", function (req, res) {
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

module.exports = router;