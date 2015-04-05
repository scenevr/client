var SERVER = 'http://login.scenevr.com';
var Template = require('../templates/login.jade');
var util = require('util');
var EventEmitter = require('wolfy87-eventemitter');

var $ = window.jQuery;

function Authentication (client) {
  this._client = client;
  this.initialize();
}

util.inherits(Authentication, EventEmitter);

Authentication.prototype.initialize = function () {
  this._isLoggedIn = null;
  this._user = null;
  this._div = $('<div id=\'authentication\' />').appendTo('body');
  this.checkStatus();

  var self = this;

  window.addEventListener('message', function (e) {
    if ((e.origin === 'http://localhost:3000') || (e.origin === 'http://login.scenevr.co m')) {
      self.checkStatus();
    } else if (e.data.match(/^OTHelpers.+/)) {
      // OpenTok spam
    } else {
      console.error('Invalid origin ' + e.origin);
    }
  });
};

Authentication.prototype.hasCompleted = function () {
  return !(this._isLoggedIn === null);
};

Authentication.prototype.getTokenFor = function (uri, callback) {
  if (!this.isLoggedIn()) {
    callback(false);
    return;
  }

  var host = uri.host;

  if (uri.port && uri.port !== 80) {
    host += ':' + uri.port;
  }

  $.ajax({
    url: SERVER + '/session/token.json',
    params: { host: host },
    type: 'GET',
    dataType: 'jsonp',
    success: function (response) {
      callback(true, response.token);
    }
  });
};

Authentication.prototype.isLoggedIn = function () {
  return this._isLoggedIn;
};

Authentication.prototype.getUser = function () {
  return this._user;
};

Authentication.prototype.displayName = function () {
  var self = this;

  this._div.empty();

  $('<button />').text(this.getUser().name).appendTo(this._div).click(function (e) {
    e.stopPropagation();
    self.showAccountSettings();
  });
};

Authentication.prototype.displayLogInButton = function () {
  var self = this;

  this._div.empty();

  $('<button />').text('Log in').appendTo(this._div).click(function (e) {
    e.stopPropagation();
    self.showLogin();
  });
};

Authentication.prototype.showAccountSettings = function () {
  var self = this;

  this._client.renderOverlay(Template({
    url: SERVER + '/'
  })).find('button').click(function () {
    self._client.hideOverlays();
  });
};

Authentication.prototype.showLogin = function () {
  var self = this;

  this._client.renderOverlay(Template({
    url: SERVER + '/users/sign_in'
  })).find('button').click(function () {
    self._client.hideOverlays();
  });
};

Authentication.prototype.checkStatus = function () {
  var self = this;

  this.statusRequest(function (ok) {
    if (self.isLoggedIn()) {
      self.displayName();
      self.trigger('ready');
    } else {
      self.displayLogInButton();
      self.trigger('ready');
    }
  });
};

Authentication.prototype.statusRequest = function (callback) {
  var self = this;

  $.ajax({
    url: SERVER + '/session/status.json',
    type: 'GET',
    dataType: 'jsonp',
    success: function (response) {
      if (response) {
        self._user = response;
        self._isLoggedIn = true;
      } else {
        self._isLoggedIn = false;
      }

      callback(true);
    }
  });
};

module.exports = Authentication;
