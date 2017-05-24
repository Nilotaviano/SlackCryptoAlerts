# SlackCryptoAlerts

This is a slack bot for setting up alerts for cryptocurrency prices.

It gets it's prices from coinmarketcap (https://api.coinmarketcap.com/v1/ticker/).

## Commands
This bot currently supports these commands:
* /alert *coin* *price*
  * Sets an alert for when the coin reaches a certain price
  * Example: /alert monero 0.018
* /alerts
  * Lists all configured alerts
* /target *coin* *target*
  * Sets a target for a call
  * Example: /target ripple x3
* /calls
  * Lists all calls
* /delete
  * Removes alerts, calls or exchange registration. To remove all alerts
  * Example 1: /delete alert ripple - deletes all of your ripple alerts
  * Example 2: /delete alert ripple 0.000018 - deletes your alert for when ripple reaches 0.000018
  * Example 3: /delete alerts all - deletes all of your alerts
  * Example 4: /delete call ripple - deletes a call on ripple
  * Example 5: /delete register bittrex - deletes your bittrex registration
* /register *exchange* *apiKey* *apiSecret*
  * Configures an exchange integration
  * You'll be able to use /getopenorders, /getorderhistory and you'll be notified after any of your orders are executed
  * Currently, only bittrex is supported, but I plan to add support for poloniex soon
  * The only needed permission is "Read"
* /getopenorders *exchange*
  * Lists your open orders
* /getorderhistory *exchange*
  * Lists your whole order history

  
  
## Tips
  
#### BTC:
> 1JZs2fXp14qhLapUxpMFPrr89xDn2VzpmQ

#### ETH:
> 0x609cB6C46596A132e559a909887A74AB40e58AfC

#### LTC:
> LcX6Wb7g6CaAq1cqhdcY6sT1FjCiVpGtQ7
