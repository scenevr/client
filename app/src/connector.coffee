Utils = require "./utils.coffee"
StyleMap = require("./style_map")
TWEEN = require("tween.js")
EventEmitter = require('wolfy87-eventemitter');
Color = require("color")
#Howl = require("howler").Howl

Billboard = require("./elements/billboard.coffee")
Box = require("./elements/box.coffee")
Skybox = require("./elements/skybox.coffee")

class Connector extends EventEmitter
  constructor: (@client, host, path) ->
    @host = host || window.location.host.split(":")[0] + ":8080"
    @path = path || "/index.xml"
    @protocol = "scenevr"
    @scene = @client.scene
    @uuid = null
    @spawned = false
    @manager = new THREE.LoadingManager()

  setPosition: (v) ->
    @client.playerBody.position.copy(v)
    @client.playerBody.position.y += 1.5
    @client.playerBody.velocity.set(0,0,0)
    @client.controls.getObject().position.copy(@client.playerBody.position)

  respawn: (reason) ->
    if !@spawned
      console.error "Tried to respawn before spawning"
      return

    @setPosition(@spawnPosition)

    if reason
      @client.addChatMessage null, "You have been respawned because #{reason}"
    else
      @client.addChatMessage null, "You have been respawned"

  isConnected: ->
    @ws and @ws.readyState == 1

  disconnect: ->
    console.log "Closing socket..."
    @ws.onopen = null
    @ws.onclose = null
    @ws.onmessage = null
    @ws.close()

    delete @ws

  reconnect: =>
    @connect()

  # Server told us to reconnect (scene probably changed)
  restartConnection: ->
    @disconnect()
    @trigger 'restarting'
    @client.removeReflectedObjects()
    clearInterval @interval
    setTimeout(@reconnect, 500)

  connect: ->
    @ws = new WebSocket("ws://#{@host}#{@path}", @protocol);
    @ws.binaryType = 'arraybuffer'
    @ws.onopen = =>
      console.log "Opened socket"
      @interval = setInterval @tick, 1000 / 5
      @trigger 'connected'
    @ws.onclose = =>
      console.log "Closed socket"
      clearInterval @interval
      @trigger 'disconnected'
    @ws.onmessage = (e) =>
      @onMessage(e)

  sendMessage: (el) ->
    if @isConnected()
      xml = "<packet>" + $("<packet />").append(el).html() + "</packet>"
      @ws.send(xml)

  sendChat: (message) ->
    @sendMessage $("<event />").
      attr("name", "chat").
      attr("message", message.slice(0,200))

  onCollide: (e) ->
    console.log "collision #{e.uuid}"
    
    @sendMessage $("<event />").
      attr("name", "collide").
      attr("uuid", e.uuid).
      attr("normal", e.normal.toArray().join(" "))

  onClick: (e) ->
    @flashObject(@scene.getObjectByName(e.uuid))

    @sendMessage $("<event />").
      attr("name", "click").
      attr("uuid", e.uuid).
      attr("point", e.point.toArray().join(" "))

  flashObject: (obj) ->
    # todo - flash white then back to normal color.
    # fixme - doesnt work on links or billboards
    if obj.material
      obj.material.setValues { transparent : true }

      tween = new TWEEN.Tween({ opacity : 0.5 })
      tween.to({ opacity : 1.0 }, 200)
        .onUpdate(-> obj.material.setValues { opacity : @opacity })
        .onComplete(-> obj.material.setValues { transparent : false })
        .easing(TWEEN.Easing.Linear.None)
        .start()


  tick: =>
    if @spawned and @isConnected()
      # send location..
      position = new THREE.Vector3(0,-0.75,0).add(@client.getPlayerObject().position)
      @sendMessage $("<player />").attr("position", position.toArray().join(" "))

  getHost: ->
    @client.getHostFromLocation()

  getAssetHost: ->
    @getHost()

  createPlayer: (el) ->
    geometry1 = new THREE.CylinderGeometry( 0.02, 0.5, 1.3, 10 )
    mesh1 = new THREE.Mesh( geometry1 )
    geometry2 = new THREE.SphereGeometry( 0.3, 10, 10 )
    mesh2 = new THREE.Mesh( geometry2 )
    mesh2.position.y = 0.6

    combined = new THREE.Geometry()
    THREE.GeometryUtils.merge( combined, mesh1 )
    THREE.GeometryUtils.merge( combined, mesh2 )

    material = new THREE.MeshPhongMaterial( {color: '#999999' } )
    new THREE.Mesh( combined, material )

  # Todo - do something special to indicate links....
  createLink: (el) ->
    obj = new THREE.Object3D

    geometry2 = new THREE.SphereGeometry( 1, 16, 16 )
    material2 = new THREE.MeshPhongMaterial( {color: '#ff7700', emissive : '#aa3300', transparent : true, opacity: 0.5 } )
    obj.add(new THREE.Mesh( geometry2, material2 ))

    geometry = new THREE.SphereGeometry( 0.5, 16, 16 )
    material = new THREE.MeshPhongMaterial( {color: '#ff7700', emissive : '#aa3300' } )
    obj.add(new THREE.Mesh( geometry, material ))

    newScale = if el.attr("scale")
      Utils.parseVector(el.attr("scale"))
    else
      new THREE.Vector3(1,1,1)

    obj.scale.copy(newScale)

    obj

  createModel: (el) ->
    obj = new THREE.Object3D
    texture = null

    styles = new StyleMap(el.attr("style"))

    material = if styles.textureMap
        new THREE.MeshLambertMaterial({ color : '#ffffff' })
      else
        new THREE.MeshBasicMaterial({ color : '#eeeeee' })

    if el.attr("style")
      if styles.lightMap || styles.textureMap
        texture = new THREE.Texture()
        loader = new THREE.ImageLoader( @manager )
        loader.crossOrigin = true
        loader.load "//" + @getAssetHost() + @getUrlFromStyle(styles.lightMap || styles.textureMap), ( image ) ->
          texture.image = image
          texture.magFilter = THREE.NearestFilter
          texture.needsUpdate = true
          material.needsUpdate = true
      else if styles['color']
        material = new THREE.MeshLambertMaterial({ color : styles['color'] })

    loader = new THREE.OBJLoader( @manager )
    loader.load "//" + @getAssetHost() + el.attr("src"), ( object ) =>
      object.traverse ( child ) =>
        if child instanceof THREE.Mesh
          child.material = material
          
          if texture
            child.material.map = texture

          if styles.collision is null || styles.collision == 'bounding-box'
            child.geometry.computeBoundingBox()
            boundingBox = child.geometry.boundingBox.clone()
            dimensions = boundingBox.max.sub(boundingBox.min)

            # Add physics model
            boxShape = new CANNON.Box(new CANNON.Vec3().copy(dimensions.multiplyScalar(0.5)))
            boxBody = new CANNON.Body({ mass: 0 })
            boxBody.addShape(boxShape)
            boxBody.position.copy(obj.position)
            boxBody.quaternion.copy(obj.quaternion)
            boxBody.uuid = el.attr('uuid')
            @client.world.add(boxBody)
            obj.body = boxBody

      obj.add(object)

    newScale = if el.attr("scale")
      Utils.parseVector(el.attr("scale"))
    else
      new THREE.Vector3(1,1,1)

    obj.scale.copy(newScale)

    obj 

  createAudio: (el) ->
    obj = new THREE.Object3D

    # if (src = el.attr("src")) and el.attr("ambient").toLowerCase() == "true"
    #   path = "//" + @getAssetHost() + src

    #   volume = if el.attr("volume")
    #       parseFloat(el.attr("volume"))
    #     else
    #       1.0

    # Disabled until we have a control panel
    
    # obj.userSound = new Howl({
    #   urls: [path]
    #   loop: true
    #   volume: volume
    # }).play();

    obj.position = new THREE.Vector3(0,0,0)

    obj

  getUrlFromStyle: (value) ->
    try
      value.match(/\((.+?)\)/)[1]
    catch e
      null

  onMessage: (e) =>
    $($.parseXML(e.data).firstChild).children().each (index, el) =>
      el = $(el)

      if el.is("event")
        name = el.attr("name")

        if name == "ready"
          @uuid = el.attr("uuid")
        else if name == "restart"
          console.log "Got restart message"
          @restartConnection()
        else if name is 'chat'
          @client.addChatMessage { name : el.attr('from') }, el.attr('message')
        else if name is 'respawn'
          @respawn(el.attr('reason'))
        else
          console.log "Unrecognized event #{el.attr('name')}"

      else if uuid = el.attr('uuid')
        if el.is("dead") 
          if obj = @scene.getObjectByName(uuid)
            if obj.body
              @client.world.remove(obj.body)
            @scene.remove(obj)
          return

        newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))
        newQuaternion = el.attr("rotation") && new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr("rotation")))

        if !(obj = @scene.getObjectByName(uuid))
          if el.is("spawn")
            obj = new THREE.Object3D()
            if !@spawned
              @spawnPosition = newPosition
              @setPosition(newPosition)
              @spawned = true

          else if el.is("billboard")
            obj = Billboard.create(el)

          else if el.is("box")
            obj = Box.create(el)

          else if el.is("model")
            obj = @createModel(el)

          else if el.is("link")
            obj = @createLink(el)

          else if el.is("skybox")
            obj = @createSkyBox(el)

          else if el.is("audio")
            obj = @createAudio(el)

          else if el.is("player")
            if uuid == @uuid
              # That's me!
              return

            if !newPosition
              # Don't add users who haven't spawned yet
              return

            obj = @createPlayer(el)

          else
            console.log "Unknown element... \n " + el[0].outerHTML
            return

          obj.name = uuid
          obj.userData = el

          if obj.body
            @client.world.add(obj.body)
            obj.body.uuid = uuid

          # skyboxes dont have a position
          if !el.is("skybox") and newPosition
            obj.position.copy(newPosition)
            if obj.body
              obj.body.position.copy(newPosition)

          if !el.is("skybox") and newQuaternion
            obj.quaternion.copy(newQuaternion)
            if obj.body
              obj.body.quaternion.copy(newQuaternion)

          if el.is("skybox")
            obj.castShadow = false
          else
            obj.castShadow = true

          @scene.add(obj)

        if el.attr("style")
          styles = new StyleMap(el.attr("style"))

          if styles["visibility"] == "hidden"
            obj.visible = false
          else
            obj.visible = true

        if el.is("spawn")
          # Don't tween spawn
          obj.position.copy(newPosition)
        else if el.is("box") or el.is("player") or el.is("billboard") or el.is("model") or el.is("link")
          # Tween away
          startPosition = obj.position.clone()

          if el.attr("rotation")
            newEuler = Utils.parseEuler(el.attr("rotation"))
            newQuaternion = new THREE.Quaternion().setFromEuler(newEuler)

            # obj.quaternion.copy(newQuaternion)

            if !obj.quaternion.equals(newQuaternion)
              tween = new TWEEN.Tween(obj.quaternion)
              tween.to(newQuaternion, 200)
                .onUpdate(-> 
                  obj.quaternion.set(@x, @y, @z, @w)
                  if obj.body
                    obj.body.quaternion.set(@x, @y, @z, @w)
                )
                .easing(TWEEN.Easing.Linear.None)
                .start()

          if !startPosition.equals(newPosition)
            tween = new TWEEN.Tween(startPosition)
            tween.to(newPosition, 200)
              .onUpdate(-> 
                obj.position.set(@x, @y, @z)
                if obj.body
                  obj.body.position.set(@x, @y, @z)
              )
              .easing(TWEEN.Easing.Linear.None)
              .start()

        if el.is("box") 
          obj.material.setValues { color : el.attr('color'), ambient : Color(el.attr('color')).hexString() }
  
module.exports = Connector