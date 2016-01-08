var Utils = require('../utils');
var StyleMap = require('../style-map');
var CANNON = require('cannon');
var THREE = require('three.js');

function Text () {
}

Text.create = function (connector, el) {
  var styles = new StyleMap(el.attr('style'));

  var material = new THREE.MeshLambertMaterial({
    color: '#eeeeee'
  });

  var depth = parseFloat(el.attr('depth') || 0.2);
  var geometry = new THREE.TextGeometry(el.html(), {
    size: 1,
    height: depth,
    weight: 'bold',
    material: 0,
    extrudeMaterial: 0,
    bevelEnabled: false
  });
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

  return obj;
};

module.exports = Text;
