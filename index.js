/* globals jQuery */

var Client = require('./app/src/client');

jQuery(function () {
  window.client = new Client();
  window.client.initialize();
});
