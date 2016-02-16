var Utils = require('../utils');
var CANNON = require('cannon');
var THREE = require('three');

var Z_AXIS_SCALE = 0.01;

function Plane () {
}

Plane.create = function (connector, el) {
  var geometry = new THREE.PlaneBufferGeometry(1, 1, 1, 1);
  var material = new THREE.MeshLambertMaterial();

  var obj = new THREE.Mesh(geometry, material);
  obj.castShadow = true;
  obj.receiveShadow = true;

  var scale = el.attr('scale') ? Utils.parseVector(el.attr('scale')) : new THREE.Vector3(1, 1, 1);
  scale.z = Z_AXIS_SCALE;
  obj.scale.copy(scale);

  // This is a bit dumb, planes are infinite in cannon, so we can't specify a size and have to emulate the
  // plane with a thin box.
  var physicsScale = scale.multiplyScalar(0.5);
  physicsScale.z = Z_AXIS_SCALE;

  var shape = new CANNON.Box(new CANNON.Vec3().copy(physicsScale));
  var body = new CANNON.Body({ mass: 0 });
  body.addShape(shape);

  obj.body = body;

  return obj;
};

module.exports = Plane;
