var request = require('request');
var db = require('./../database/db');
var bittrex = require('node.bittrex.api');
var poloniex = require('poloniex-api-node');

function updateAcronymsMapping() {
    bittrex.getmarkets(function(response) {
        if(response.success && response.result) {
            var acronyms = db.getCollection('acronyms');
            //Removes previous mappings
            acronyms.chain().where(function(acronym){
                return acronym.exchance == 'bittrex'
            }).remove();
            
            var markets = response.result;
            
            for (var i in markets) {
                acronyms.insert({
                    acronym: markets[i].MarketCurrency,
                    name: markets[i].MarketCurrencyLong,
                    exchance: 'bittrex'
                });
            }
        }
    });
        
    new poloniex().returnCurrencies(function(err, body){
        if(err)
            console.log(err);
        else {
            var acronyms = db.getCollection('acronyms');
            
            for(var acronym in body)
            {
                var acronymEntry = body[acronym];
                if(!acronymEntry.delisted && !acronymEntry.disabled)
                    acronyms.insert({
                        acronym: acronym,
                        name: acronymEntry.name,
                        exchance: 'poloniex'
                    });
            }
        }
    });
    
    /*request('https://api.coinmarketcap.com/v1/ticker/', function(error, response, body) {
            
        if (!error && response.statusCode == 200) {
            var currencies = JSON.parse(response.body);

            for (var i in currencies) {
                acronyms.insert({
                    acronym: currencies[i].symbol,
                    name: currencies[i].id
                });
            }
        }
    });*/
}

module.exports = updateAcronymsMapping;