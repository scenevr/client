/* globals jQuery */

var Client = require('./app/src/client');

jQuery(function () {
  var client = new Client();
  client.initialize();
});
