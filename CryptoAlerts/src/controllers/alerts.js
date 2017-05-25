var express = require('express');
var router = express.Router();
var request = require('request');
var db = require('./../database/db');
var helper = require('./../helpers/alerts');

router.post("/new", function(req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");

  if (splitText.length >= 2) {
    var currency = splitText[0];
    var alertPrice = splitText[1];
    var message = splitText.slice(2, splitText.length).join(" ");
    
    helper.setAlert(username, currency, alertPrice, message, 'user', function(error, triggerCondition) {
      if (!error) {
        var messageJson = {
          //response_type: 'in_channel',
          text: 'I will warn you when ' + currency + ' ' + triggerCondition + ' ' + alertPrice
        };

        console.log('Message sent: ', messageJson);

        res.send(messageJson);
      }
      else {
        res.send('Error: ' + error);
        console.log('Error: ', error);
      }
    });
  }
  else {
    var messageJson = {
      text: 'Unexpected format. Command format is "/alert coin price".'
    };

    console.log('Message sent: ', messageJson);

    res.send(messageJson);
  }
});

router.post("/", function(req, res) {
  var responseMessage = 'Alerts:\n'
  var alerts = db.getCollection('alerts');
  var allAlerts = alerts.find();

  for (var i = 0; i < allAlerts.length; i++) {
    responseMessage = responseMessage.concat('Currency: ', allAlerts[i].currency, ', ', 'Price: ', allAlerts[i].price, ', ', 'User: ', allAlerts[i].user, ', ', 'Message: ', allAlerts[i].message, '\n');
  }

  var messageJson = {
    response_type: 'in_channel',
    text: responseMessage
  };

  console.log('Message sent: ', messageJson);

  res.send(messageJson);
});

module.exports = router;