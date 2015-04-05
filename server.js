var browserify = require('browserify-middleware');
var express = require('express');
var app = express();
var fs = require('fs');
var expressLess = require('express-less');

app.use('/js/bundle.js', browserify('./index.js', {
  transform: ['browserify-jade']
}));

app.use('/css', expressLess(__dirname + '/css'));

app.use(express.static(__dirname));

app.get('/connect/*', function (req, res) {
  res.send(fs.readFileSync(__dirname + '/index.html').toString());
});

console.log('[webclient] Listening for connections on localhost:9000...');

app.listen(9000);
