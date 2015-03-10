
var SERVER = "http://login.scenevr.com",
  Template = require("../templates/login.jade"),
  URI = require("uri-js");

function Authentication(client){
  this._client = client;
  this._isLoggedIn = null;
  this._user = null;
  this._div = $("<div id='authentication' />").appendTo('body');
  this.checkStatus();

  var self = this;

  window.addEventListener("message", function(e){
    if((e.origin === "http://localhost:3000") || (e.origin === "http://login.scenevr.com")){
      self.checkStatus();
    }else{
      console.error("Invalid origin");
    }
  });
}

Authentication.prototype.getTokenFor = function(uri, callback){
  if(!this.isLoggedIn()){
    callback(false)
    return;
  }

  var components = URI.parse(this.uri),
    host = components.host;

  if(components.port && components.port != 80){
    host += ":" + components.port;
  }

  $.ajax({
    url : SERVER + "/session/token.json",
    params : { host : host },
    type : 'GET',
    dataType: "jsonp",
    success : function(response){
      callback(true, response.token);
    }
  });
}

Authentication.prototype.isLoggedIn = function(){
  return this._isLoggedIn;
}

Authentication.prototype.getUser = function(){
  return this._user;
}

Authentication.prototype.displayName = function(){
  var self = this;

  this._div.empty();

  $("<button />").text(this.getUser().name).appendTo(this._div).click(function(e){
    e.stopPropagation();
    self.showAccountSettings();
  });
}

Authentication.prototype.displayLogInButton = function(){
  var self = this;

  this._div.empty();

  $("<button />").text("Log in").appendTo(this._div).click(function(e){
    e.stopPropagation();
    self.showLogin();
  });
}

Authentication.prototype.showAccountSettings = function(){
  this._client.renderOverlay(Template({
    url : SERVER + "/"
  }));
}

Authentication.prototype.showLogin = function(){
  this._client.renderOverlay(Template({
    url : SERVER + "/users/sign_in"
  }));
}

Authentication.prototype.checkStatus = function(){
  var self = this;

  this.statusRequest(function(ok){
    if(self.isLoggedIn()){
      self.displayName();

      // The connector might not exist - should this be decoupled a bit?
      self._client.connector.authenticate();
    }else{
      self.displayLogInButton();
    }
  })
};

Authentication.prototype.statusRequest = function(callback){
  var self = this;

  $.ajax({
    url : SERVER + "/session/status.json",
    type : 'GET',
    dataType: "jsonp",
    success : function(response){
      if(response){
        self._user = response;
        self._isLoggedIn = true;
      }else{
        self._isLoggedIn = false;
      }

      callback(true);
    }
  });
}

module.exports = Authentication;