var THREE = window.THREE;
var util = require('util');
var EventEmitter = require('wolfy87-eventemitter');
var URI = require('uri-js');

var $ = window.jQuery;

function Asset (callback, processor, args) {
  for (var key in args) {
    this[key] = args[key];
  }
  this.loaded = false;
  this.processor = processor;
  this.on('loaded', callback);

  this.load();
}

util.inherits(Asset, EventEmitter);

Asset.prototype.load = function () {
  console.log('[Asset] loading ' + this.url);

  $.ajax({
    success: this.onLoad.bind(this),
    error: this.onError.bind(this),
    url: this.url
  });

  // var loader = new THREE.XHRLoader(THREE.DefaultLoadingManager);
  // loader.setCrossOrigin(true);
  // loader.load(this.url, this.onLoad.bind(this), this.onProgress.bind(this), this.onError.bind(this));
};

Asset.prototype.onLoad = function (data) {
  if (this.processor) {
    data = this.processor(data);
  }

  this.value = data;
  this.loaded = true;
  this.trigger('loaded', [this.value]);
};

Asset.prototype.onError = function (xhr, status, err) {
  console.error('Error loading ' + this.url + ': ' + err.toString());
};

function AssetManager () {
  this.assets = {};
}

AssetManager.prototype.createKey = function (url) {
  return url;
};

AssetManager.prototype.load = function (url, processor, callback) {
  var key = this.createKey(url);
  var asset = this.assets[key];

  if (asset && asset.loaded) {
    callback(asset.value);
  } else if (asset) {
    asset.on('loaded', callback);
  } else {
    this.assets[key] = new Asset(callback, processor, {
      url: url
    });
  }
};

AssetManager.prototype.loadObj = function (url, callback) {
  this.load(url, function (data) {
    var objLoader = new THREE.OBJLoader();
    return objLoader.parse(data);
  }, function (obj) {
    callback(obj.clone());
  });
};

AssetManager.prototype.loadMtl = function (url, callback) {
  var baseUrl = url.substr(0, url.lastIndexOf('/') + 1);

  this.load(url, function (data) {
    var mtlLoader = new THREE.MTLLoader(baseUrl, null, true, URI.resolve);
    return mtlLoader.parse(data);
  }, function (materialCreator) {
    callback(materialCreator);
  });
};

module.exports = AssetManager;
