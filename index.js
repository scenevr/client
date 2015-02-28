(function() {
  var Client;

  Client = require("./app/src/client");

  $(function() {
    return setTimeout(function() {
      return window.client = new Client;
    }, 250);
  });

}).call(this);
