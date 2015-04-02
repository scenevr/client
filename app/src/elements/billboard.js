var Utils = require('../utils');
var URI = require('uri-js');

// For jshint
var THREE = window.THREE;
var $ = window.jQuery;
var CANNON = window.CANNON;
var html2canvas = window.html2canvas = require('html2canvas');

function RenderQueue () {
  this.queue = [];
  this.processing = false;
  this.interjobDelay = 25;
}

RenderQueue.prototype.add = function (job) {
  this.queue.push(job);

  if (!this.processing) {
    this.nextJob();
  }
};

RenderQueue.prototype.nextJob = function () {
  var job = this.queue.shift(),
    self = this;

  if (!job || this.processing) {
    return;
  }

  this.processing = true;

  job(function () {
    setTimeout(function () {
      self.processing = false;
      self.nextJob();
    }, self.interjobDelay);
  });
};

var rQueue = new RenderQueue();

var SIZE = 512;

function Billboard () {
}

Billboard.create = function (connector, el) {
  var box, boxBody, boxShape, geometry, material, mesh, newScale;
  var obj = new THREE.Object3D();

  var div = $('<div />').html(el.text()).css({
    zIndex: 50,
    position: 'absolute',
    left: 0,
    top: 0,
    background: 'white',
    width: SIZE,
    height: SIZE,
    padding: '10px',
    border: '1px solid #ccc',
    fontSize: '22px'
  });

  div.find('img').each(function (index, img) {
    img.src = URI.resolve(connector.uri, img.getAttribute('src'));
  });

  div.appendTo('body');
  geometry = new THREE.BoxGeometry(1, 1, 1);
  material = new THREE.MeshLambertMaterial({
    color: '#eeeeee',
    ambient: '#eeeeee'
  });
  box = new THREE.Mesh(geometry, material);
  material = new THREE.MeshLambertMaterial({
    color: '#ffffff'
  });
  mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), material);
  mesh.position.setZ(0.52);

  obj.add(box);
  obj.add(mesh);

  newScale = el.attr('scale') ? Utils.parseVector(el.attr('scale')) : new THREE.Vector3(2, 2, 0.5);
  obj.scale.copy(newScale);

  boxShape = new CANNON.Box(new CANNON.Vec3().copy(newScale.multiplyScalar(0.5)));
  boxBody = new CANNON.Body({
    mass: 0
  });
  boxBody.addShape(boxShape);

  obj.body = boxBody;

  rQueue.add(function (finished) {
    html2canvas(div[0], {
      useCORS: true,
      letterRendering: false
    }).then(function (canvas) {
      var texture;
      texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;

      material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      });

      material.transparent = false;
      mesh.material = material;

      div.remove();

      finished();
    });
  });

  return obj;
};

module.exports = Billboard;
