Element = require "./element.coffee"

DEFAULT_COLOR = '#eeeeee'

class Box extends Element
  create: ->
    geometry = new THREE.BoxGeometry( 1, 1, 1 )
    material = new THREE.MeshLambertMaterial( {color: DEFAULT_COLOR } )
    @obj = new THREE.Mesh( geometry, material )
    @obj.scale.copy(@getScale())
    @createPhysicsModel()
    @obj

  # Add physics model
  createPhysicsModel: ->
    boxShape = new CANNON.Box(new CANNON.Vec3().copy(@getScale().multiplyScalar(0.5)))
    boxBody = new CANNON.Body({ mass: 0 })
    boxBody.addShape(boxShape)
    @obj.body = boxBody
    
module.exports = Box