Utils = require "./utils"
TWEEN = require("tween.js")

class Connector
  constructor: (@client, host, port) ->
    @host = host || window.location.host.split(":")[0]
    @port = port || 8080
    @protocol = "scene-server"
    @packets = []
    @scene = @client.scene
    @uuid = null
    @spawnedYet = false

  setPosition: (v) ->
    @client.getPlayerObject().position = v

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

  sendMessage: (message) ->
    xml = "<packet>" + message + "<packet>"
    console.log "> #{xml}"
    @ws.send(xml)

  # dispatchPackets: ->
  #   message = JSON.stringify(@packets)
  #   console.log message
  #   @ws.send(message)

  tick: =>
    # send location..

  onMessage: (e) =>
    # console.log e.data

    $(e.data).children().each (index, el) =>
      el = $(el)

      if el.is("event")
        name = el.attr("name")

        if name == "ready"
          @uuid = el.attr("uuid")
        else
          console.log "Unrecognized event #{message}"

      else if uuid = el.attr('uuid')
        if el.is("dead")
          @scene.remove(obj)
          return

        newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))

        if !(obj = @scene.getObjectById(uuid))
          if el.is("spawn")
            obj = new THREE.Object3D()
            if !@spawnedYet
              @setPosition newPosition
              @spawnedYet = true

          else if el.is("box")
            geometry = new THREE.BoxGeometry( 1, 1, 1 )
            material = new THREE.MeshLambertMaterial( {color: '#eeeeee' } )
            obj = new THREE.Mesh( geometry, material )

          obj.id = uuid
          obj.position = newPosition
          @scene.add(obj)

        if el.is("spawn")
          # Don't tween spawn
          obj.position = newPosition
        else if el.is("box")
          # Tween away
          startPosition = obj.position.clone()
          if !startPosition.equals(newPosition)
            tween = new TWEEN.Tween(startPosition)
            tween.to(newPosition, 500)
              .onUpdate(-> obj.position = new THREE.Vector3(@x, @y, @z))
              .easing(TWEEN.Easing.Linear.None)
              .start()

        if el.is("box")
          obj.material = new THREE.MeshLambertMaterial( {color: el.attr('color') } )
  
module.exports = Connector