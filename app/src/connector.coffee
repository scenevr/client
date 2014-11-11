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
    @client.getPlayerObject().position.copy(v)

  connect: ->
    @ws = new WebSocket("ws://#{@host}:#{@port}/", @protocol);
    @ws.binaryType = 'arraybuffer'
    @ws.onopen = =>
      console.log "Opened socket"
      @interval = setInterval @tick, 1000 / 5
      @trigger 'connected'
    @ws.onclose = =>
      console.log "Closed socket"
      clearInterval @interval
      @trigger 'disconnected'
    @ws.onmessage = @onMessage

  sendMessage: (el) ->
    xml = "<packet>" + $("<packet />").append(el).html() + "</packet>"
    @ws.send(xml)

  onClick: (e) ->
    @flashObject(@scene.getObjectByName(e.uuid))

    @sendMessage $("<event />").
      attr("name", "click").
      attr("uuid", e.uuid).
      attr("point", e.point.toArray().join(" "))

  flashObject: (obj) ->
    # todo - flash white then back to normal color
    if obj.material
      obj.material.setValues { transparent : true }

      tween = new TWEEN.Tween({ opacity : 0.5 })
      tween.to({ opacity : 1.0 }, 200)
        .onUpdate(-> obj.material.setValues { opacity : @opacity })
        .onComplete(-> obj.material.setValues { transparent : false })
        .easing(TWEEN.Easing.Linear.None)
        .start()


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
        if el.is("dead") 
          if obj = @scene.getObjectByName(uuid)
            @scene.remove(obj)
          return

        newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))

        if !(obj = @scene.getObjectByName(uuid))
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

            geometry1 = new THREE.CylinderGeometry( 0.02, 0.5, 1.3, 10 )
            mesh1 = new THREE.Mesh( geometry1 )
            geometry2 = new THREE.SphereGeometry( 0.3, 10, 10 )
            mesh2 = new THREE.Mesh( geometry2 )
            mesh2.position.y = 0.6

            combined = new THREE.Geometry()
            THREE.GeometryUtils.merge( combined, mesh1 )
            THREE.GeometryUtils.merge( combined, mesh2 )

            material = new THREE.MeshPhongMaterial( {color: '#999999' } )
            obj = new THREE.Mesh( combined, material )

          else
            console.log "Unknown element..."
            console.log el[0].outerHTML

          obj.name = uuid
          obj.position.copy(newPosition)
          obj.castShadow = true
          @scene.add(obj)

          if obj.material
            obj.material.setValues { transparent : true, opacity: 0.5 }

            tween = new TWEEN.Tween({ opacity : 0.0 })
            tween.to({ opacity : 1.0 }, 200)
              .onUpdate(-> obj.material.setValues { opacity : @opacity })
              .onComplete(-> obj.material.setValues { transparent : false })
              .easing(TWEEN.Easing.Linear.None)
              .start()

        if el.is("spawn")
          # Don't tween spawn
          obj.position.copy(newPosition)
        else if el.is("box") or el.is("player")
          # Tween away
          startPosition = obj.position.clone()
          if !startPosition.equals(newPosition)
            tween = new TWEEN.Tween(startPosition)
            tween.to(newPosition, 200)
              .onUpdate(-> obj.position.set(@x, @y, @z))
              .easing(TWEEN.Easing.Linear.None)
              .start()

        if el.is("box") 
          obj.material.setValues { color : el.attr('color') }
  
module.exports = Connector