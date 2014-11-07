Utils = require "./utils"

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
      el = $(message)
      
      uuid = el.attr('uuid')

      if !(obj = @scene.getObjectById(uuid))
        geometry = new THREE.BoxGeometry( 1, 1, 1 )
        material = new THREE.MeshLambertMaterial( {color: '#eeeeee' } )
        obj = new THREE.Mesh( geometry, material )
        obj.id = uuid
        @scene.add(obj)

      obj.position = Utils.parseVector(el.attr("position"))

      if el.is("box")
        obj.material = new THREE.MeshLambertMaterial( {color: el.attr('color') } )
  
module.exports = Connector