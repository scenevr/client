Utils = {
  parseVector: (value) ->
    vector = new THREE.Vector3().fromArray(value.split(' ').map(parseFloat))

    if isFinite(vector.length())
      vector
    else
      raise "Invalid vector string"

  parseEuler: (attributeString) ->
    [x,y,z] = attributeString.split(' ').map(parseFloat)
    new THREE.Euler x,y,z

}

module.exports = Utils