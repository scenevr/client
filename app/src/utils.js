(function() {
  var Utils;

  Utils = {
    parseVector: function(value) {
      var vector;
      vector = new THREE.Vector3().fromArray(value.split(' ').map(parseFloat));
      if (isFinite(vector.length())) {
        return vector;
      } else {
        return raise("Invalid vector string");
      }
    },
    parseEuler: function(value) {
      var euler;
      euler = new THREE.Euler().fromArray(value.split(' ').map(parseFloat));
      if (isFinite(euler.x) && isFinite(euler.y) && isFinite(euler.z)) {
        return euler;
      } else {
        return raise("Invalid euler string");
      }
    }
  };

  module.exports = Utils;

}).call(this);
