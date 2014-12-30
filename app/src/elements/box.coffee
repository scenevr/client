Utils = require "../utils.coffee"

class Box
  constructor: ->
    true

Box.create = (connector, el) ->
  geometry = new THREE.BoxGeometry( 1, 1, 1 )
  material = new THREE.MeshLambertMaterial( {color: '#eeeeee' } )
  obj = new THREE.Mesh( geometry, material )

  newScale = if el.attr("scale")
    Utils.parseVector(el.attr("scale"))
  else
    new THREE.Vector3(1,1,1)

  obj.scale.copy(newScale)
  
  # Add physics model
  boxShape = new CANNON.Box(new CANNON.Vec3().copy(newScale.multiplyScalar(0.5)))
  boxBody = new CANNON.Body({ mass: 0 })
  boxBody.addShape(boxShape)
  obj.body = boxBody

  obj

    
module.exports = Box