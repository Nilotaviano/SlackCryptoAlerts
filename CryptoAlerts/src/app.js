var express = require('express');
var bodyParser = require('body-parser');
var workers = require('./workers')

var app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.use(require('./controllers'));

app.listen(parseInt(process.env.PORT), function (err) {
  if (err) {
    throw err
  }
  
  workers.initialize();
  
  console.log('Server started on port ' + process.env.PORT);
})