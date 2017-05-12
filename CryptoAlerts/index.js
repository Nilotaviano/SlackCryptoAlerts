var express    = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var request = require('request');
var loki = require('lokijs');

var IncomingWebhook = require('@slack/client').IncomingWebhook;

var url = process.env.SLACK_WEBHOOK_URL || ''; //see section above on sensitive data

var app = express();
var db = new loki('loki.json');

var alerts = db.addCollection('alerts')

app.use(bodyParser.urlencoded({
    extended: true
}));

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

app.post("/alerts/new", function (req, res) {
  var username = req.body.user_name;
  var splitText = req.body.text.split(" ");
  var currency = splitText[0];
  var alertPrice = splitText[1];
  
  // Test if the coin exists on coinmarketcap
  request('https://api.coinmarketcap.com/v1/ticker/' + currency, function (error, response, body) {
    if(!error && response.statusCode == 200) {
      var responseJson = JSON.parse(response.body)[0];
      var currentPrice = responseJson.price_btc;
      var triggerCondition = alertPrice > currentPrice ? '>' : '<';
      
      alerts.insert( { currency : currency, user: username , price: alertPrice, condition: triggerCondition } );

      res.send('Alerta configurado');
    }
    else {
      var responseJson = JSON.parse(response.body);
      res.send('Erro: ' + responseJson.error);
    }
  });
});

// Tell our app to listen on port 8080
app.listen(8080, function (err) {
  if (err) {
    throw err
  }
  
  console.log('Server started on port 8080')
})