var request = require('request');
var db = require('./../database/db');

function updateAcronymsMapping() {
    request('https://api.coinmarketcap.com/v1/ticker/', function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var acronyms = db.getCollection('acronyms');
            var currencies = JSON.parse(response.body);

            //Removes previous mappings
            acronyms.chain().remove();

            for (var i in currencies) {
                acronyms.insert({
                    acronym: currencies[i].symbol,
                    name: currencies[i].id
                });
            }
        }
    });
}

module.exports = updateAcronymsMapping;
