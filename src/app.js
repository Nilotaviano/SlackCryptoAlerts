var express = require('express');
var bodyParser = require('body-parser');
var workers = require('./workers');
var db = require('./database/db');
var ON_DEATH = require('death')({ uncaughtException: true }) 

var app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.use(require('./controllers'));

ON_DEATH(function (signal, err) {
    console.log(err);
    db.close();
})

app.listen(parseInt(process.env.PORT), function (err) {
  if (err) {
    throw err
  }
  
  workers.initialize();
  
  console.log('Server started on port ' + process.env.PORT);
});