Box = require('./elements/box')
Model = require('./elements/model')

class PacketIntroducing
  @id: 0x01

  constructor: (array) ->
    [nil, @xml] = array

  toWireFormat: ->
    [PacketIntroducing.id, @xml]

  process: (scene) ->
    element = scene.getElementById(@id)

    if element
      # todo - reparse the xml without deleting / creating the element
      scene.removeChild(element)

    dom = $(@xml).first()

    @id = dom.attr('id')

    element = switch dom.get(0).nodeName.toLowerCase()
      when 'box' then new Box @id
      when 'model' then new Model @id
      else
        throw "Invalid element introduced"
    
    element.position = utils.attributeToVector(dom.attr('position'))
    element.rotation = utils.attributeToEuler(dom.attr('rotation'))
    element.scale = utils.attributeToVector(dom.attr('scale'))

    if dom.attr('src')
      element.src = dom.attr('src')

    scene.appendChild(element)

    true

class PacketUpdate
  @id: 0x02

  constructor: (array) ->
    [nil, @id, @positionX, @positionY, @positionZ, @rotationX, @rotationY, @rotationZ] = array

  toWireFormat: ->
    [PacketUpdate.id, @id, @positionX, @positionY, @positionZ, @rotationX, @rotationY, @rotationZ]

  process: (scene) ->
    element = scene.getElementById(@id)

    if !element
      # console.log "Trying to update non-present element #{@id}"
      return

    newPosition = new THREE.Vector3 @positionX, @positionY, @positionZ

    if !newPosition.equals(element.position)
      tween = new TWEEN.Tween( { x : element.position.x, y : element.position.y, z : element.position.z } )
      tween.to( { x : newPosition.x, y : newPosition.y, z : newPosition.z }, 500).
        easing(TWEEN.Easing.Linear.None).
        onUpdate( -> element.position = new THREE.Vector3(@x, @y, @z)).
        start()
    
    newRotation = new THREE.Euler @rotationX, @rotationY, @rotationZ

    if !newRotation.equals(element.rotation)
      tween = new TWEEN.Tween( { x : element.rotation.x, y : element.rotation.y, z : element.rotation.z } )
      tween.to( { x : @rotationX, y : @rotationY, z : @rotationZ }, 500).
        easing(TWEEN.Easing.Linear.None).
        onUpdate( -> element.rotation = new THREE.Euler(@x, @y, @z)).
        start()


    element.notify()

    true

class PacketGone
  @id: 0x03
  
  constructor: (array) ->
    [nil, @id] = array

  process: (scene) ->
    element = scene.getElementById(@id)
    if !element
      scene.removeChild(element)
    true

class PacketAuthenticate
  @id: 0x10
  
  constructor: (array) ->
    [nil, @nick, @credentials] = array

  process: (scene, client) ->
    if @success
      client.avatar = { id : @id }
    else
      # todo create some UI for this...
      console.log "Failed to authenticate with the scene server..."
    true

class PacketAuthResponse
  @id: 0x11
  
  constructor: (array) ->
    [nil, @success, @id] = array

  process: (scene, client) ->
    if @success
      client.avatar = { id : @id }
    else
      # todo create some UI for this...
      console.log "Failed to authenticate with the scene server..."
    true

# Construct the exports...
packets = {
  "Introducing" : PacketIntroducing
  "Update" : PacketUpdate
  "Gone" : PacketGone
  "AuthResponse" : PacketAuthResponse
}

dictionary = {}

for key, value of packets
  dictionary[value.id] = value

module.exports = {
  packets : packets
  dictionary : dictionary
}