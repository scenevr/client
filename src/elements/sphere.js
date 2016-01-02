var Utils = require('../utils');
var StyleMap = require('../style-map');
var CANNON = require('cannon');
var THREE = require('three.js');

function Sphere () {
}

Sphere.create = function (connector, el) {
  var styles = new StyleMap(el.attr('style'));
  var segments = el.attr('segments') || 6;
  var geometry = new THREE.SphereGeometry(0.5, segments, segments);

  var material = new THREE.MeshLambertMaterial({
      color: '#eeeeee'
    });

  var obj = new THREE.Mesh(geometry, material);
  var scale = el.attr('scale') ? Utils.parseVector(el.attr('scale')) : new THREE.Vector3(1, 1, 1);
  obj.scale.copy(scale);

  if (styles.collision === 'none') {
    // No collision at all
  } else {
    var shape = new CANNON.Sphere(scale.length() * 0.5);
    var body = new CANNON.Body({ mass: 0 });

    if (styles.collision === 'trigger') {
      body.collisionResponse = false;
    }

    body.addShape(shape);

    obj.body = body;
  }

  return obj;
};

module.exports = Sphere;
