var Utils = require('../utils');
var StyleMap = require('../style-map');
var CANNON = require('cannon');
var THREE = require('three');

// For 3d text
var TextGeometry = require('../../vendor/text-geometry.js');

function Text () {
}

function center (geometry) {
  geometry.computeBoundingBox();

  var bb = geometry.boundingBox;
  var midpoint = bb.min.clone().add(bb.max).multiplyScalar(0.5);

  // Center text on x axis

  midpoint.y = 0;
  midpoint.z = 0;
  midpoint.negate();

  geometry.vertices.forEach((v) => {
    v.add(midpoint);
  });

  geometry.verticesNeedUpdate = true;

  console.log(midpoint);
}

Text.create = function (connector, el) {
  var styles = new StyleMap(el.attr('style'));

  var material = new THREE.MeshLambertMaterial({
    color: '#eeeeee'
  });

  var depth = parseFloat(el.attr('depth') || 0.2);
  var geometry = new TextGeometry(el.html(), {
    size: 1,
    height: depth,
    weight: 'bold',
    material: 0,
    extrudeMaterial: 0,
    bevelEnabled: false
  });

  center(geometry);

  var obj = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial([material, material]));

  var scale = el.attr('scale') ? Utils.parseVector(el.attr('scale')) : new THREE.Vector3(1, 1, 1);
  obj.scale.copy(scale);

  obj.castShadow = true;
  obj.receiveShadow = true;

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

  console.log('Created text');
  console.log(obj);

  return obj;
};

module.exports = Text;
