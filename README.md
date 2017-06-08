# SlackCryptoAlerts

This is a slack bot for setting up alerts for cryptocurrency prices, notifying people about executed orders and checking prices.

## Setup
#### Environment variables
* PORT: The port in which the server will run
* DB_NAME: The name which will be used to persist the database
* ALERTS_WEBHOOK_URL: Webhook which will be used to send messages for triggered alerts
* EXCHANGES_WEBHOOK_URL: Webhook which will be used to send messages for executed orders

#### Slash commands
* Create one for every command [below](#commands)

#### Webhooks
* You need at least one webhook, however, I use one for alerts (ALERTS_WEBHOOK_URL) and another for executed orders (EXCHANGES_WEBHOOK_URL)

#### Installation
* Clone or download this repository
* Inside the CryptoAlerts directory, run `<npm install>` to install dependencies
* Start the server using `<node src/app.js>`
* I highly recommend you to use something like [pm2](https://github.com/Unitech/pm2) to set your environment variables and auto-restart the server in case of a crash (which will happen a lot, given that this is the first time I use node.js)

## Commands
This bot currently supports these commands:
* /alert *coin* *price*
  * Sets an alert for when the coin reaches a certain price
  * Example: /alert monero 0.018
  * Route: /alerts/new
* /alerts
  * Lists all configured alerts
  * Route: /alerts
* /target *coin* *target*
  * Sets a target for a call
  * Example: /target ripple x3
  * Route: /calls/new
* /calls
  * Lists all calls
  * Route: /calls
* /delete
  * Removes alerts, calls or exchange registrations.
  * Example 1: /delete alert ripple - deletes all of your ripple alerts
  * Example 2: /delete alert ripple 0.000018 - deletes your alert for when ripple reaches 0.000018
  * Example 3: /delete alerts all - deletes all of your alerts
  * Example 4: /delete call ripple - deletes a call on ripple
  * Example 5: /delete register bittrex - deletes your bittrex registration
  * Route:/delete
* /register *exchange* *apiKey* *apiSecret*
  * Configures an exchange integration
  * You'll be able to use /getopenorders, /getorderhistory
  * You'll be notified after any of your orders are executed
    * +10%, -10%, +100% and -50% alerts are automatically set for every executed order.
  * Currently, only bittrex and poloniex are supported
  * **Do not allow any other permission besides "READ INFO", I will not be responsible if something happens to your portifolio**
  * Route: /exchanges/register
* /getopenorders *exchange*
  * Lists your open orders
  * Route: /exchanges/getopenorders
* /getorderhistory *exchange*
  * Lists your whole order history
  * Route: /exchanges/getorderhistory
* /price *currencyAcronym*
  * Returns the current price from exchanges
  * Currently, only bittrex and poloniex are supported
  * Example: /price XRP
  * Route: /price
* /currency *currency* *convert* (optional)
  * Returns the current price from coinmarketcap, optionally converting it to a target currency
  * Example: /currency ripple USD
  * Route: /currency

## Tips
  
#### BTC:
> 1JZs2fXp14qhLapUxpMFPrr89xDn2VzpmQ

#### ETH:
> 0x609cB6C46596A132e559a909887A74AB40e58AfC

#### LTC:
> LcX6Wb7g6CaAq1cqhdcY6sT1FjCiVpGtQ7
