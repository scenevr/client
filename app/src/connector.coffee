Utils = require "./utils"
TWEEN = require("tween.js")
EventEmitter = require('wolfy87-eventemitter');

class Connector extends EventEmitter
  constructor: (@client, host, port) ->
    @host = host || window.location.host.split(":")[0]
    @port = port || 8080
    @protocol = "scene-server"
    @packets = []
    @scene = @client.scene
    @uuid = null
    @spawned = false

  setPosition: (v) ->
    @client.getPlayerObject().position = v

  connect: ->
    @ws = new WebSocket("ws://#{@host}:#{@port}/", @protocol);
    @ws.binaryType = 'arraybuffer'
    @ws.onopen = =>
      console.log "Opened socket"
      @interval = setInterval @tick, 1000 / 2
      @trigger 'connected'
    @ws.onclose = =>
      console.log "Closed socket"
      clearInterval @interval
      @trigger 'disconnected'
    @ws.onmessage = @onMessage

  sendMessage: (el) ->
    xml = "<packet>" + $("<packet />").append(el).html() + "<packet>"
    @ws.send(xml)

  tick: =>
    position = new THREE.Vector3(0,-0.75,0).add(@client.getPlayerObject().position)

    if @spawned
      # send location..
      @sendMessage $("<player />").attr("position", position.toArray().join(" "))

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
        if el.is("dead") and obj = @scene.getObjectById(uuid)
          @scene.remove(obj)
          return

        newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))

        if !(obj = @scene.getObjectById(uuid))
          if el.is("spawn")
            obj = new THREE.Object3D()
            if !@spawned
              @setPosition newPosition
              @spawned = true

          else if el.is("box")
            geometry = new THREE.BoxGeometry( 1, 1, 1 )
            material = new THREE.MeshLambertMaterial( {color: '#eeeeee' } )
            obj = new THREE.Mesh( geometry, material )

          else if el.is("player")
            if uuid == @uuid
              # That's me!
              return

            if !newPosition
              # Don't add users who haven't spawned yet
              return

            geometry = new THREE.BoxGeometry( 0.33, 1.5, 0.33 )
            material = new THREE.MeshLambertMaterial( {color: '#999999' } )
            obj = new THREE.Mesh( geometry, material )

          obj.id = uuid
          obj.position = newPosition
          @scene.add(obj)

        if el.is("spawn")
          # Don't tween spawn
          obj.position = newPosition
        else if el.is("box") or el.is("player")
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