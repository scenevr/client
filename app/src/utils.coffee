Utils = {
  parseVector: (value) ->
    vector = new THREE.Vector3().fromArray(value.split(' ').map(parseFloat))

    if isFinite(vector.length())
      vector
    else
      raise "Invalid vector string"

  parseEuler: (value) ->
    euler = new THREE.Euler().fromArray(value.split(' ').map(parseFloat))

    if isFinite(euler.x) && isFinite(euler.y) && isFinite(euler.z)
      euler
    else
      raise "Invalid euler string"

}

module.exports = Utils