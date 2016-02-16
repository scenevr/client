var THREE = require('three');

var Utils = {
  parseVector: function (value) {
    var vector = new THREE.Vector3().fromArray(value.split(' ').map(parseFloat));
    if (isFinite(vector.length())) {
      return vector;
    } else {
      console.log('Invalid vector string');
      return new THREE.Vector3(0, 0, 0);
    }
  },
  parseEuler: function (value) {
    var euler = new THREE.Euler().fromArray(value.split(' ').map(parseFloat));
    if (isFinite(euler.x) && isFinite(euler.y) && isFinite(euler.z)) {
      return euler;
    } else {
      console.log('Invalid euler string');
      return new THREE.Euler(0, 0, 0);
    }
  }
};

module.exports = Utils;
