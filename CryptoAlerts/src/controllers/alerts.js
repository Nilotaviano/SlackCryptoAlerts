var express = require('express');
var router = express.Router();
var request = require('request');
var db = require('./../database/db');
var helper = require('./../helpers/alerts');
var exchangesHelper = require('./../helpers/exchanges');

router.post("/new", function(req, res) {
  var username = req.body.user_name;
  var commandParams = parseCommandParams(req.body.text);

  if (commandParams.valid) {

    // TODO: Allow both currency name or acronym
    helper.setAlert(username, null, commandParams.currencyAcronym, null, commandParams.alertPrice, commandParams.message, 'user', commandParams.exchange, commandParams.baseCurrency, function(error, triggerCondition) {
      if (!error) {
        var messageJson = {
          //response_type: 'in_channel',
          text: 'I will warn you when ' + commandParams.currencyAcronym + ' ' + triggerCondition + ' ' + commandParams.alertPrice + ' ' + commandParams.baseCurrency + ' on ' + commandParams.exchange
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
    var message = 'Unexpected format. Example command: /alert 1ST at 0.5 ETH on bittrex "damn"';
    
    if (commandParams.errorMessage != null)
      message = commandParams.errorMessage;

    var messageJson = {
      text: message
    };

    console.log('Message sent: ', messageJson);

    res.send(messageJson);
  }
});

function parseCommandParams(commandText) {
  var result = new Object();
  result.valid = true;

  var splitText = commandText.split(' ');

  result.currencyAcronym = splitText[0].toUpperCase();
  result.alertPrice = splitText[2];
  result.baseCurrency = splitText[3];
  result.exchange = splitText[5];

  if (result.currencyAcronym == null || result.alertPrice == null || isNaN(result.alertPrice) || result.baseCurrency == null) {
    result.valid = false;

    return result;
  }
  
  if (exchangesHelper.supportedExchanges.indexOf(result.exchange) == -1) {
    result.errorMessage = "Exchange not supported. The available exchanges are: " + JSON.stringify(exchangesHelper.supportedExchanges);
    result.valid = false;

    return result;
  }

  var messageStartIndex = commandText.indexOf('"');

  if (messageStartIndex > 0) {
    var messageEndIndex = commandText.indexOf('"', messageStartIndex + 1);

    if (messageEndIndex > 0) {
      result.message = commandText.substr(messageStartIndex + 1, messageEndIndex - messageStartIndex - 1);
    }
    else {
      result.valid = false;

      return result;
    }
  }

  return result;
}

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
