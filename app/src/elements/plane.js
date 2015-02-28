var Utils = require("../utils");

var Z_AXIS_SCALE = 0.01;

function Plane() {
}

Plane.create = function(connector, el) {
  var geometry = new THREE.PlaneBufferGeometry(1, 1, 1, 1),
    material = new THREE.MeshLambertMaterial({
      color: '#eeeeee'
    });

  var obj = new THREE.Mesh(geometry, material);
  
  var newScale = el.attr("scale") ? Utils.parseVector(el.attr("scale")) : new THREE.Vector3(1, 1, 1);
  newScale.z = Z_AXIS_SCALE;
  obj.scale.copy(newScale);

  // This is a bit dumb, planes are infinite in cannon, so we can't specify a size and have to emulate the 
  // plane with a thin box.
  var physicsScale = newScale.multiplyScalar(0.5);
  physicsScale.z = Z_AXIS_SCALE;

  var shape = new CANNON.Box(new CANNON.Vec3().copy(physicsScale)),
    body = new CANNON.Body({ mass: 0 });
  body.addShape(shape);

  obj.body = body;

  return obj;
};

module.exports = Plane;
