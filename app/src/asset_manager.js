/* globals THREE, Worker */

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
  $.ajax({
    success: this.onLoad.bind(this),
    error: this.onError.bind(this),
    url: this.url
  });
};

Asset.prototype.onLoad = function (data) {
  var self = this;

  if (this.processor) {
    this.processor(data, function (data) {
      self.value = data;
      self.loaded = true;
      self.trigger('loaded', [self.value]);
    });
  } else {
    this.value = data;
    this.loaded = true;
    this.trigger('loaded', [this.value]);
  }
};

Asset.prototype.onError = function (xhr, status, err) {
  console.error('Error loading ' + this.url + ': ' + err.toString());
};

function AssetManager () {
  this.assets = {};
  this.objLoader = new Worker('/vendor/obj-loader.js');
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
  var self = this;
  var filename = url.split('/').slice(-1);

  this.load(url, function (data, callback) {
    // var objLoader = new THREE.OBJLoader();
    // var obj = objLoader.parse(data);
    // console.timeEnd('load obj ' + filename);

    self.objLoader.postMessage([filename, data, callback]);

    // w.onmessage = function (e) {
    //   callback(e.data);
    // };
  }, function (obj) {
    callback(obj.clone());
  });
};

AssetManager.prototype.loadMtl = function (url, callback) {
  var baseUrl = url.substr(0, url.lastIndexOf('/') + 1);

  this.load(url, function (data, callback) {
    var mtlLoader = new THREE.MTLLoader(baseUrl, null, true, URI.resolve);
    callback(mtlLoader.parse(data));
  }, function (materialCreator) {
    callback(materialCreator);
  });
};

module.exports = AssetManager;
