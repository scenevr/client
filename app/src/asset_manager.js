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

  this.initObjLoader();
}

AssetManager.prototype.initObjLoader = function () {
  var self = this;

  this.objLoader = new Worker('/vendor/obj-loader.js');

  this.objLoader.onmessage = function (e) {
    var asset = self.assets[e.data[0]];
    var objects = e.data[1];

    var container = new THREE.Object3D();

    for (var i = 0, l = objects.length; i < l; i++) {
      var object = objects[ i ];
      var geometry = object.geometry;

      var buffergeometry = new THREE.BufferGeometry();
      buffergeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(geometry.vertices), 3));

      if (geometry.normals.length > 0) {
        buffergeometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(geometry.normals), 3));
      }

      if (geometry.uvs.length > 0) {
        buffergeometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.uvs), 2));
      }

      var material = new THREE.MeshLambertMaterial();
      material.name = object.material.name;

      var mesh = new THREE.Mesh(buffergeometry, material);
      mesh.name = object.name;

      container.add(mesh);
    }

    asset.value = container;
    asset.loaded = true;
    asset.trigger('loaded', [asset.value]);
  };
};

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

  this.load(url, function (data, callback) {
    self.objLoader.postMessage([url, data]);
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
