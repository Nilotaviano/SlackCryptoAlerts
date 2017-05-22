var express = require('express');
var router = express.Router();

var request = require('request');
var db = require('./../database/db');

router.post("/", function (req, res) {
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

router.post("/new", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  
  if(splitText.length >= 2) {
    var currency = splitText[0];
    var calls = db.getCollection('calls');

    // Checa se já existe uma call para a moeda
    var existsCallForCurrency = calls.chain().where(function(call) { return call.currency == currency }).data().length > 0;
    
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

module.exports = router;