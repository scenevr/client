Utils = require "./utils"
TWEEN = require("tween.js")

class Connector
  constructor: (@client, host, port) ->
    @host = host || window.location.host.split(":")[0]
    @port = port || 8080
    @protocol = "scene-server"
    @packets = []
    @scene = @client.scene

  connect: ->
    @ws = new WebSocket("ws://#{@host}:#{@port}/", @protocol);
    @ws.binaryType = 'arraybuffer'
    @ws.onopen = =>
      console.log "Opened socket"
      @interval = setInterval @tick, 1000 / 2
    @ws.onclose = =>
      console.log "Closed socket"
      clearInterval @interval
    @ws.onmessage = @onMessage

  sendPacket: (packet) ->
    @packets.push packet

  # dispatchPackets: ->
  #   message = JSON.stringify(@packets)
  #   console.log message
  #   @ws.send(message)

  tick: =>
    # send location..

  onMessage: (e) =>
    for message in JSON.parse(e.data)
      do (message) =>
        el = $(message)
        uuid = el.attr('uuid')

        newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))

        if !(obj = @scene.getObjectById(uuid))
          geometry = new THREE.BoxGeometry( 1, 1, 1 )
          material = new THREE.MeshLambertMaterial( {color: '#eeeeee' } )
          obj = new THREE.Mesh( geometry, material )
          obj.id = uuid
          obj.position = newPosition
          @scene.add(obj)

        if el.is("box")
          startPosition = obj.position.clone()
          if !startPosition.equals(newPosition)
            tween = new TWEEN.Tween(startPosition)
            tween.to(newPosition, 500)
              .onUpdate(-> obj.position = new THREE.Vector3(@x, @y, @z))
              .easing(TWEEN.Easing.Linear.None)
              .start()

        if el.is("box")
          obj.material = new THREE.MeshLambertMaterial( {color: el.attr('color') } )

        if el.is("dead")
          @scene.remove(obj)
  
module.exports = Connector