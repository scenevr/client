// var createTileMap = require('gl-tile-map');
// var createBuffer = require('gl-buffer');
// var createVAO = require('gl-vao');
// var ndarray = require('ndarray');
// var fill = require('ndarray-fill');
// var ops = require('ndarray-ops');
// var createAOMesh = require('ao-mesher');
// var createAOShader = require('aoshader.js');
// var glm = require('gl-matrix');
// var mat4 = glm.mat4;
// var shader = createAOShader(gl)

var Utils = require('../utils');
var StyleMap = require('../style-map');
var CANNON = require('cannon');
var THREE = require('three');

function Voxel () {
}

Voxel.create = function (connector, el) {
  var styles = new StyleMap(el.attr('style'));

  var geometry = new THREE.BoxGeometry(1, 1, 1);
  var material = new THREE.MeshLambertMaterial({
    color: '#eeeeee'
  });

  var obj = new THREE.Mesh(geometry, material);
  var scale = el.attr('scale') ? Utils.parseVector(el.attr('scale')) : new THREE.Vector3(1, 1, 1);
  obj.scale.copy(scale);

  if (styles.collision === 'none') {
    // No collision at all
  } else {
    var boxShape = new CANNON.Box(new CANNON.Vec3().copy(scale.multiplyScalar(0.5))),
      boxBody = new CANNON.Body({ mass: 0 });

    if (styles.collisionResponse === 'false') {
      boxBody.collisionResponse = false;
    }

    boxBody.addShape(boxShape);

    obj.body = boxBody;
  }

  return obj;
};

module.exports = Voxel;
