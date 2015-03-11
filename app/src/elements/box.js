var Box, Utils;

Utils = require("../utils");

function Box() {
}

Box.create = function(connector, el) {
  var boxBody, boxShape, geometry, material, newScale, obj;

  geometry = new THREE.BoxGeometry(1, 1, 1);
  material = new THREE.MeshLambertMaterial({
    color: '#eeeeee'
  });

  obj = new THREE.Mesh(geometry, material);
  newScale = el.attr("scale") ? Utils.parseVector(el.attr("scale")) : new THREE.Vector3(1, 1, 1);
  obj.scale.copy(newScale);

  boxShape = new CANNON.Box(new CANNON.Vec3().copy(newScale.multiplyScalar(0.5)));
  boxBody = new CANNON.Body({
    mass: 0
  });

  boxBody.addShape(boxShape);

  obj.body = boxBody;
  
  return obj;
};

module.exports = Box;
