var express = require('express');
var router = express.Router();
var request = require('request');
var db = require('./../database/db');
var helper = require('./../helpers/exchanges');

var supportedExchanges = [ "bittrex" ];

router.post("/list", function(req, res) {
  var messageJson = 
    {
      //response_type: 'in_channel',
      text: 'The exchanges available for consult are ' + supportedExchanges.toString()
    };
    
  console.log('Message sent: ', messageJson);
  
  res.send(messageJson);
});

router.post("/register", function(req, res) {
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
    
  validateExchangeName(res, exchangeName);
  
  var apiKey = splitText[1];
  var apiSecret = splitText[2];
  
  helper.bittrexAPICall(res, userid, apiKey, apiSecret, 'market/getopenorders', 'market=BTC-LTC', function (error, response, body)
  {
    var exchanges = db.getCollection('exchanges');
    
    var query = exchanges.chain().where(function(registry) { return registry.userid == userid && registry.exchange == exchangeName});
    query.remove();
    
    var registryDate = new Date();
    registryDate.setMinutes(registryDate.getMinutes()-65);
    exchanges.insert({ username: username, userid: userid, exchange: exchangeName, apikey: apiKey, apiSecret: apiSecret, lastCheck: registryDate.getTime() });
    
    var messageJson = "The apikey has been succesfully registered";
    
    res.send(messageJson);
  });
  
});

router.post('/getopenorders', function(req, res) {
    var username = req.body.user_name;
    var userid = req.body.user_id;
    var exchangeName = req.body.text;
    
    validateExchangeName(res, exchangeName);
    
    if(exchangeName == 'bittrex')
      helper.getOpenOrdersBittrex(res, username, userid);
});

router.post('/getorderhistory', function(req, res) {
    var username = req.body.user_name;
    var userid = req.body.user_id;
    var exchangeName = req.body.text;
    
    validateExchangeName(res, exchangeName);
    
    if(exchangeName == 'bittrex')
      respondOrderHistoryBittrex(res, userid);
});

function validateExchangeName(res, exchangeName)
{ 
  if(exchangeName == '')
  {
    res.send("Please inform the exchange name. Ex.: "+supportedExchanges[0]);
    return;
  }
  
  if(supportedExchanges.indexOf(exchangeName) == -1)
  {
    res.send("Exchange not supported. The available exchanges are: "+JSON.stringify(supportedExchanges));
    return;
  }
}

function respondOrderHistoryBittrex(res, userid)
{
  helper.getOrderHistoryBittrex(res, userid, function(orders)
  {
    if(orders == null)
      return;
    var ordersDescriptions = [];
    for(var i = 0; i < orders.length; i++)
    {
      var openOrder = orders[i];
      var currency = openOrder.Exchange.split('-')[1];
      var orderType = openOrder.OrderType == 'LIMIT_SELL' ? 'Venda' : 'Compra';
      var quantity = openOrder.Quantity;
		  var price = openOrder.PricePerUnit;
		 
		  var orderDescription = currency + '|' + orderType + '|' + quantity + '|' + price;
		  
		  ordersDescriptions.unshift(orderDescription);
    }
    
    var responseMessage = 'All your order history is:\n';
    for(var i in ordersDescriptions)
		  responseMessage = responseMessage.concat(ordersDescriptions[i] + '\n');
    
    var messageJson = { 
      text: responseMessage
    }
    
    res.send(messageJson);
  });
}

module.exports = router;