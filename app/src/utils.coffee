define [], ->
  utils = 
    attributeToVector: (attributeString) ->
      [x,y,z] = attributeString.split(' ').map(parseFloat)
      new THREE.Vector3 x,y,z

    attributeToEuler: (attributeString) ->
      [x,y,z] = attributeString.split(' ').map(parseFloat)
      new THREE.Euler x,y,z

  utils