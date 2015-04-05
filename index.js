var Client = require('./app/src/client');

window.jQuery(function () {
  setTimeout(function () {
    window.client = new Client();
  }, 250);
});
