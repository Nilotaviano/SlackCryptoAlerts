var request = require('request');
var db = require('./../database/db');
var bittrex = require('node.bittrex.api');


function setAlert(username, currency, currencyAcronym, currentPrice, alertPrice, message, source, exchange, baseCurrency, callback) {
    // Test if the coin exists

    if (exchange == 'bittrex') {
        bittrex.getticker({
            market: baseCurrency + "-" + currencyAcronym
        }, function(ticker) {
            if (ticker.success) {
                var currentPrice = ticker.result.Last.toFixed(8);

                var triggerCondition = alertPrice > currentPrice ? '>' : '<';

                var alerts = db.getCollection('alerts');

                alerts.insert({
                    currency: currency,
                    acronym: currencyAcronym,
                    user: username,
                    price: alertPrice,
                    condition: triggerCondition,
                    message: message,
                    source: source,
                    exchange: exchange,
                    baseCurrency: baseCurrency
                });

                if (callback != null)
                    callback(null, triggerCondition);
            }
            else {
                if (callback != null)
                    callback(ticker.message, null);
            }
        })
    }
    else {
        callback('Only working for bittrex at the moment :(', null);
    }
}

module.exports = {
    setAlert: setAlert
};
