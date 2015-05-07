var THREE = require('three');

var Utils = {
  parseVector: function (value) {
    var vector = new THREE.Vector3().fromArray(value.split(' ').map(parseFloat));
    if (isFinite(vector.length())) {
      return vector;
    } else {
      throw new Error('Invalid vector string');
    }
  },
  parseEuler: function (value) {
    var euler = new THREE.Euler().fromArray(value.split(' ').map(parseFloat));
    if (isFinite(euler.x) && isFinite(euler.y) && isFinite(euler.z)) {
      return euler;
    } else {
      throw new Error('Invalid euler string');
    }
  }
};

module.exports = Utils;
