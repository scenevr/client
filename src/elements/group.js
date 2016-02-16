var THREE = require('three');

function Group () {
}

Group.create = function (connector, el) {
  return new THREE.Object3D();
};

module.exports = Group;
