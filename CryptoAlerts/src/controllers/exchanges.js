var express = require('express');
var router = express.Router();
var request = require('request');
var db = require('./../database/db');
var helper = require('./../helpers/exchanges');
var poloniex = require('poloniex-api-node');

router.post("/list", function(req, res) {
  var messageJson = {
    //response_type: 'in_channel',
    text: 'The exchanges available for consult are ' + helper.supportedExchanges.toString()
  };

  console.log('Message sent: ', messageJson);

  res.send(messageJson);
});

router.post("/register", function(req, res) {
  var username = req.body.user_name;
  var userid = req.body.user_id;
  var splitText = req.body.text.split(" ");

  if (splitText.length != 3) {
    var messageJson = {
      text: 'You should say the exchange you want to register, your api key and the api secret'
    };

    console.log('Message sent: ', messageJson);

    res.send(messageJson);
  }

  var exchangeName = splitText[0];

  validateExchangeName(res, exchangeName);

  var apiKey = splitText[1];
  var apiSecret = splitText[2];

  if (exchangeName == "bittrex") {
    helper.bittrexAPICall(apiKey, apiSecret, 'market/getopenorders', 'market=BTC-LTC', function(error, response, body) {
      if (!error) {
        var exchanges = db.getCollection('exchanges');

        var query = exchanges.chain().where(function(registry) {
          return registry.userid == userid && registry.exchange == exchangeName
        });
        query.remove();

        var registryDate = new Date();
        registryDate.setMinutes(registryDate.getMinutes() - 65);
        exchanges.insert({
          username: username,
          userid: userid,
          exchange: exchangeName,
          apikey: apiKey,
          apiSecret: apiSecret,
          lastCheck: registryDate.getTime()
        });

        var message = "The apikey has been succesfully registered";

        console.log('Message sent: ', message);

        res.send(message);
      }
      else {
        var message = "Couldn't connect to the exchange, is your api correct?";

        console.log('Message sent: ', message);

        res.send(message);
      }
    });
  }
  else if (exchangeName == "poloniex") {
    var polo = new poloniex(apiKey, apiSecret);

    polo.returnOpenOrders("BTC_LTC", function(err, openOrders) {
      if (err) {
        var message = "Error while testing API keys. Error: " + err.message;

        console.log('Message sent: ', message);

        res.send(message);
      }
      else {
        var exchanges = db.getCollection('exchanges');

        var query = exchanges.chain().where(function(registry) {
          return registry.userid == userid && registry.exchange == exchangeName
        });
        query.remove();

        var registryDate = new Date();
        registryDate.setMinutes(registryDate.getMinutes() - 65);
        exchanges.insert({
          username: username,
          userid: userid,
          exchange: exchangeName,
          apikey: apiKey,
          apiSecret: apiSecret,
          lastCheck: registryDate.getTime()
        });

        var message = "The apikey has been succesfully registered";

        console.log('Message sent: ', message);

        res.send(message);
      }
    });
  }
});

router.post('/getopenorders', function(req, res) {
  var username = req.body.user_name;
  var userid = req.body.user_id;
  var exchangeName = req.body.text;

  validateExchangeName(res, exchangeName);

  if (exchangeName == 'bittrex') {
    helper.getOpenOrdersBittrex(res, username, userid);
  }
  else if (exchangeName == "poloniex") {
    var apiRegistry = helper.getAPIKey(exchangeName, userid);

    var polo = new poloniex(apiRegistry.apikey, apiRegistry.apiSecret);

    polo.returnOpenOrders("all", function(err, openOrders) {
      if (err) {
        var message = "Error: " + err.message;

        console.log('Message sent: ', message);

        res.send(message);
      }
      else {
        var actualOpenOrders = new Object();

        for (var key in openOrders) {
          if (openOrders.hasOwnProperty(key) && openOrders[key].length > 0) {
            actualOpenOrders[key] = openOrders[key];
          }
        }
        var message = "Open orders:\n" + JSON.stringify(actualOpenOrders, null, 4);

        console.log('Message sent: ', message);

        res.send(message);
      }
    });
  }
});

router.post('/getorderhistory', function(req, res) {
  var username = req.body.user_name;
  var userid = req.body.user_id;
  var exchangeName = req.body.text;

  validateExchangeName(res, exchangeName);

  if (exchangeName == 'bittrex')
    respondOrderHistoryBittrex(res, userid);
  else if (exchangeName == "poloniex") {
    var apiRegistry = helper.getAPIKey(exchangeName, userid);

    var polo = new poloniex(apiRegistry.apikey, apiRegistry.apiSecret);

    var start = new Date();
    start.setMonth(start.getMonth() - 1);
    var end = new Date();

    // Dividing by 1000 converts the date to unix timestamp
    polo.returnMyTradeHistory("all", start / 1000, end / 1000, function(err, history) {
      if (err) {
        var message = "Error: " + err.message;

        console.log('Message sent: ', message);

        res.send(message);
      }
      else {
        var message = "Order history:\n" + JSON.stringify(history, null, 4);

        console.log('Message sent: ', message);

        res.send(message);
      }
    });
  }

});

function validateExchangeName(res, exchangeName) {
  if (exchangeName == '') {
    var message = "Please inform the exchange name. Ex.: " + helper.supportedExchanges[0];
    console.log('Message sent: ', message);
    res.send(message);
    return;
  }

  if (helper.supportedExchanges.indexOf(exchangeName) == -1) {
    var message = "Exchange not supported. The available exchanges are: " + JSON.stringify(helper.supportedExchanges);
    console.log('Message sent: ', message);
    res.send(message);
    return;
  }
}

function respondOrderHistoryBittrex(res, userid) {
  helper.getOrderHistoryBittrex(res, userid, function(orders) {
    if (orders == null)
      return;
    var ordersDescriptions = [];
    
    var acronyms = db.getCollection('acronyms');
    
    for (var i = 0; i < orders.length; i++) {
      var openOrder = orders[i];
      var acronym = openOrder.Exchange.split('-')[1];
      var currency = acronyms.find({'acronym': acronym.toUpperCase()})[0].name;
      var orderType = openOrder.OrderType == 'LIMIT_SELL' ? 'Venda' : 'Compra';
      var quantity = openOrder.Quantity;
      var price = openOrder.PricePerUnit;

      var orderDescription = currency + '	' + orderType + '	' + quantity + '	' + price;

      ordersDescriptions.unshift(orderDescription);
    }

    var responseMessage = 'All your order history is:\n';
    for (var i in ordersDescriptions)
      responseMessage = responseMessage.concat(ordersDescriptions[i] + '\n');

    var messageJson = {
      text: responseMessage
    }

    console.log('Message sent: ', messageJson);

    res.send(messageJson);
  });
}

module.exports = router;
