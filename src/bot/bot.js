var SlackBot = require('slackbots');

var bot_token = process.env.SLACK_BOT_TOKEN || '';

function sendMessageToUser(username, message) {
    if (bot_token === undefined)
        return;
        
    var bot = new SlackBot({
        token: bot_token,
        name: 'CryptoAlerts'
    });
    
    bot.on('start', function() {
        console.log('Sending direct message to ' + username + '\nMessage:\n' + message);
        bot.postMessageToUser(username, message)
    });

}

module.exports = {
    sendMessageToUser: sendMessageToUser
};