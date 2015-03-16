'use strict';

var Utils = require("../utils"),
  StyleMap = require("../style_map");

function Sphere() {
}

Sphere.create = function(connector, el) {
  var styles = new StyleMap(el.attr("style")),
    segments = el.attr("segments") || 6,
    geometry = new THREE.SphereGeometry(0.5, segments, segments),
    material = new THREE.MeshLambertMaterial({
      color: '#eeeeee'
    });

  var obj = new THREE.Mesh(geometry, material),
    scale = el.attr("scale") ? Utils.parseVector(el.attr("scale")) : new THREE.Vector3(1, 1, 1);
  obj.scale.copy(scale);

  if(styles.collision === 'none'){
    // No collision at all
  }else{
    var shape = new CANNON.Sphere(scale.length() * 0.5),
      body = new CANNON.Body({ mass: 0 });

    if(styles.collision === 'trigger'){
      body.collisionResponse = false;
    }

    body.addShape(shape);

    obj.body = body;
  }

  return obj;
};

module.exports = Sphere;
