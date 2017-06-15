var request = require('request');
var db = require('./../database/db');

function setAlert(username, currency, currencyAcronym, alertPrice, message, source, exchange, callback) {
    // Test if the coin exists on coinmarketcap
    request('https://api.coinmarketcap.com/v1/ticker/' + currency, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var responseJson = JSON.parse(response.body)[0];
            var currentPrice = responseJson.price_btc;
            var triggerCondition = alertPrice > currentPrice ? '>' : '<';
            
            if(currencyAcronym == null)
                currencyAcronym = responseJson.symbol;

            var alerts = db.getCollection('alerts');

            alerts.insert({
                currency: currency,
                acronym: currencyAcronym,
                user: username,
                price: alertPrice,
                condition: triggerCondition,
                message: message,
                source: source,
                exchange: exchange
            });

            if (callback != null)
                callback(null, triggerCondition);
        }
        else {
            if (callback != null)
                callback(responseJson.error, null);
        }
    });
}

module.exports = {
    setAlert: setAlert
};