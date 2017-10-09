var request = require('request');
var jsSHA = require("jssha");
var db = require('./../database/db');

var supportedExchanges = ["bittrex", "poloniex"];

function getOpenOrdersBittrex(res, username, userid) {
  var apiRegistry = getAPIKey('bittrex', userid);

  if (apiRegistry == null) {
    var messageJson = {
      text: "I wasn't able to find your apikey. Please register one to check your orders"
    };

    res.send(messageJson);
    return;
  }

  bittrexAPICall(apiRegistry.apikey, apiRegistry.apiSecret, 'market/getopenorders', '', function(error, response, body) {
    var responseJson = JSON.parse(response.body);
    var orders = [];
    for (var i = 0; i < responseJson.result.length; i++) {
      var openOrder = responseJson.result[i];
      var currency = openOrder.Exchange.split('-')[1];
      var orderType = openOrder.OrderType == 'LIMIT_SELL' ? 'Sell' : 'Buy';
      var quantity = openOrder.QuantityRemaining;
      var price = openOrder.Limit;
      var isConditional = openOrder.IsConditional;

      var orderDescription = currency + ': ' + orderType + ' ' + quantity + ' at ' + price;

      if (openOrder.IsConditional) {
        var condition = openOrder.Condition == 'GREATER_THAN' ? '>' : '<';
        var conditionTarget = openOrder.ConditionTarget;

        orderDescription = orderDescription.concat(' when ' + condition + ' ' + conditionTarget);
      }
      orders.push(orderDescription);
    }

    orders.sort();

    var responseMessage = 'Your open orders are:\n';
    for (var i in orders)
      responseMessage = responseMessage.concat(orders[i] + '\n');

    var messageJson = {
      text: responseMessage
    }

    res.send(messageJson);
  });
}

function getOrderHistoryBittrex(res, userid, ordersFunction) {
  var apiRegistry = getAPIKey('bittrex', userid);

  if (apiRegistry == null) {
    if (res != null) {
      var messageJson = {
        text: "I wasn't able to find your apikey. Please register one to check your orders"
      };

      res.send(messageJson);
    }
    return;
  }

  bittrexAPICall(apiRegistry.apikey, apiRegistry.apiSecret, 'account/getorderhistory', '', function(error, response, body) {
    var responseJson = JSON.parse(response.body);
    if(responseJson.success) {
      if (ordersFunction != null)
        ordersFunction(responseJson.result);
    } 
    else if(responseJson.message && res)
      res.send(responseJson.message);
  });
}

function bittrexAPICall(apikey, apisecret, commandRoute, commandParameters, callback) {
  var nonce = Date.now;
  var uri = 'https://bittrex.com/api/v1.1/' + commandRoute + '?apikey=' + apikey + '&nonce=' + nonce + (commandParameters != '' ? '&' + commandParameters : '');
  var shaObj = new jsSHA("SHA-512", "TEXT");
  shaObj.setHMACKey(apisecret, "TEXT");
  shaObj.update(uri);
  var sign = shaObj.getHMAC("HEX");

  var options = {
    uri: uri,
    agent: false,
    method: 'GET',
    headers: {
      "User-Agent": "Mozilla/4.0 (compatible; Node Bittrex API)",
      "Content-type": "application/x-www-form-urlencoded",
      "apisign": sign
    }
  };

  request(uri, options, function(error, response, body) {
    callback(error, response, body);
  });
}

function getAPIKey(exchangeName, userid) {
  var exchanges = db.getCollection('exchanges');

  var x = exchanges.find();

  var query = exchanges.chain().where(function(exchange) {
    return exchange.userid == userid && exchange.exchange == exchangeName
  });
  var registries = query.data();

  if (registries.length == 0)
    return null;

  var bittrexRegistry = registries[0];
  return bittrexRegistry;
}

module.exports = {
  getOpenOrdersBittrex: getOpenOrdersBittrex,
  getOrderHistoryBittrex: getOrderHistoryBittrex,
  bittrexAPICall: bittrexAPICall,
  getAPIKey: getAPIKey,
  supportedExchanges: supportedExchanges
};