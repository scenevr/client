Utils = require "./utils.coffee"
URI = require("uri-js")
StyleMap = require("./style_map")
TWEEN = require("tween.js")
EventEmitter = require('wolfy87-eventemitter');
Color = require("color")

Billboard = require("./elements/billboard.coffee")
Box = require("./elements/box.coffee")
Skybox = require("./elements/skybox.coffee")
Fog = require("./elements/fog.coffee")

Utils = require("./utils.coffee")

class Connector extends EventEmitter
  constructor: (@client, @scene, @physicsWorld, @uri, isPortal, referrer) ->
    @uri
    @isPortal = isPortal || false
    @referrer = referrer || null
    @protocol = "scenevr"
    @uuid = null
    @spawned = false
    @manager = new THREE.LoadingManager()

    @spawnPosition = null

    # Currently not supported in markup
    @spawnRotation = new THREE.Euler(0,0,0)

    @addLights()
    @addFloor()

  addFloor: ->
    floorTexture = new THREE.ImageUtils.loadTexture( '/images/grid.png' )
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set( 1000, 1000 )

    floorMaterial = new THREE.MeshBasicMaterial( { fog: true, map: floorTexture } );
    floorGeometry = new THREE.PlaneBufferGeometry(1000, 1000, 1, 1)
    
    @floor = new THREE.Mesh(floorGeometry, floorMaterial)
    @floor.position.y = 0
    @floor.rotation.x = -Math.PI / 2

    @scene.add(@floor)

    groundBody = new CANNON.Body { mass: 0 } # static
    groundShape = new CANNON.Plane()
    groundBody.addShape(groundShape)
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
    
    @physicsWorld.add(groundBody)

  addLights: ->
    dirLight = new THREE.DirectionalLight( 0xffffff, 1.1)
    dirLight.position.set( -1, 0.75, 0.92 )

    @scene.add( dirLight )

    ambientLight = new THREE.AmbientLight(0x404040)
    @scene.add(ambientLight)

  isPortalOpen: ->
    !!@portal

  loadPortal: (el, obj) ->
    if @isPortal
      console.error "Portal tried to #loadPortal"
      return

    destinationUri = URI.resolve(@uri, el.attr('href'))

    @portal = {}
    @portal.el = el
    @portal.obj = obj
    @portal.scene = new THREE.Scene
    @portal.world = new CANNON.World
    @portal.connector = new Connector(@client, @portal.scene, @portal.world, destinationUri, true, @uri)
    @portal.connector.connect()

    # Treat portals that we are going back to differently from ones we are entering for the first time
    if el.attr("backlink") is "true"
      @portal.connector.isPreviousPortal = true

    @stencilScene = new THREE.Scene

  closePortal: ->
    @scene.remove(@portal.obj)

    @portal.connector.disconnect()

    delete @portal.scene
    delete @portal.world
    delete @portal.connector
    delete @portal

    delete @stencilScene

  createPortal: (el, obj) ->
    @loadPortal(el, obj)

    while obj.children[0]
      obj.remove(obj.children[0])
      
    glowTexture = new THREE.ImageUtils.loadTexture( '/images/portal.png' )
    glowTexture.wrapS = glowTexture.wrapT = THREE.RepeatWrapping;
    glowTexture.repeat.set( 1, 1 )

    glowMaterial = new THREE.MeshBasicMaterial( { map: glowTexture, transparent : true, side : THREE.DoubleSide } );
    glowGeometry = new THREE.PlaneBufferGeometry(2, 2, 1, 1)
    glow = new THREE.Mesh(glowGeometry, glowMaterial)

    portalMaterial = new THREE.MeshBasicMaterial { color : '#000000', side : THREE.DoubleSide }
    portalGeometry = new THREE.CircleGeometry(1 * 0.75, 40)
    portal = new THREE.Mesh(portalGeometry, portalMaterial)
    portal.position.z = 0.001

    obj.add(glow)
    obj.add(portal)

    newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))

    portalClone = portal.clone()
    portalClone.position.copy(newPosition)
    portalClone.position.z += 0.1
    portalClone.quaternion.copy(obj.quaternion)
    portalClone.visible = true
    portalClone.updateMatrix()
    portalClone.updateMatrixWorld(true)
    portalClone.matrixAutoUpdate = false
    portalClone.frustumCulled = false

    @stencilScene.add(portalClone)

    obj

  setPosition: (v) ->
    @client.playerBody.position.copy(v)
    @client.playerBody.position.y += 1.5
    @client.playerBody.velocity.set(0,0,0)
    @client.controls.getObject().position.copy(@client.playerBody.position)
    @client.controls.getObject().rotation.y = 0

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

    if @client
      @client.removeReflectedObjects()

    clearInterval @interval
    setTimeout(@reconnect, 500)

  connect: ->
    components = URI.parse(@uri)

    if !components.host or !components.path.match(/^\//)
      throw "Invalid uri string #{@uri}"

    @ws = new WebSocket("ws://#{components.host}:#{components.port || 80}#{components.path}", @protocol);
    @ws.binaryType = 'arraybuffer'
    @ws.onopen = =>
      if @client
        @interval = setInterval @tick, 1000 / 5
      @trigger 'connected'
    @ws.onclose = =>
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

  getAssetHost: ->
    components = URI.parse(@uri)
    "//" + components.host + ":" + (components.port || 80)

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

  createLink: (el) ->
    obj = new THREE.Object3D

    styles = new StyleMap(el.attr("style"))
    color = styles.color || "#ff7700"

    geometry2 = new THREE.SphereGeometry( 0.25, 16, 16 )
    material2 = new THREE.MeshPhongMaterial( {color: color, emissive : color, transparent : true, opacity: 0.5 } )
    obj.add(new THREE.Mesh( geometry2, material2 ))

    geometry = new THREE.SphereGeometry( 0.12, 16, 16 )
    material = new THREE.MeshPhongMaterial( {color: color, emissive : color } )
    obj.add(new THREE.Mesh( geometry, material ))

    obj.onClick = =>
      if @portal && @portal.obj == obj
        @closePortal()
      else if @portal
        @closePortal()
        @createPortal(el, obj)
      else
        @createPortal(el, obj)

    obj.body = null
    
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

          if !styles.collision || styles.collision is 'bounding-box'
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

  addElement: (el) ->
    uuid = el.attr('uuid')

    newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))
    newQuaternion = el.attr("rotation") && new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr("rotation")))

    if el.is("spawn")
      obj = new THREE.Object3D()

      if !@spawned
        @spawnPosition = newPosition

        if @isPortal && @isPreviousPortal
          # do nothing..
        else if @isPortal
          rotation = @spawnRotation.clone()
          rotation.y += 3.141

          position = @spawnPosition.clone()
          position.add(new THREE.Vector3(0,1.28,0))

          @addElement(
            $("<link />").
              attr("position", position.toArray().join(' ')).
              attr("rotation", [rotation.x, rotation.y, rotation.z].join(' ')).
              attr("backlink", true).
              attr("href", @referrer).
              attr("style", "color : #0033ff")
          )
        else
          @setPosition(newPosition)

        @spawned = true

    else if el.is("billboard")
      obj = Billboard.create(this, el)

    else if el.is("box")
      obj = Box.create(this, el)

    else if el.is("skybox")
      obj = Skybox.create(this, el)

    else if el.is("fog")
      Fog.create(this, el)
      return

    else if el.is("model")
      obj = @createModel(el)

    else if el.is("link")
      obj = @createLink(el)

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
      @physicsWorld.add(obj.body)
      obj.body.uuid = uuid

    if !el.is("skybox,fog") and newPosition
      obj.position.copy(newPosition)
      if obj.body
        obj.body.position.copy(newPosition)

    if !el.is("skybox,fog") and newQuaternion
      obj.quaternion.copy(newQuaternion)
      if obj.body
        obj.body.quaternion.copy(newQuaternion)

    if el.is("skybox")
      obj.castShadow = false
    else
      obj.castShadow = true

    @scene.add(obj)
    
    obj

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
              @physicsWorld.remove(obj.body)
            @scene.remove(obj)
          return

        newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))
        newQuaternion = el.attr("rotation") && new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr("rotation")))

        if !(obj = @scene.getObjectByName(uuid))
          obj = @addElement(el)
          if !obj
            return

        if el.attr("style")
          styles = new StyleMap(el.attr("style"))

          if styles["visibility"] == "hidden"
            obj.visible = false
          else
            obj.visible = true

        if el.is("spawn")
          # Don't tween spawn
          obj.position.copy(newPosition)
        else if obj and (el.is("box") or el.is("player") or el.is("billboard") or el.is("model") or el.is("link"))
          # Tween away
          startPosition = obj.position.clone()

          if el.attr("rotation")
            newEuler = Utils.parseEuler(el.attr("rotation"))
            newQuaternion = new THREE.Quaternion().setFromEuler(newEuler)

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

        styles = new StyleMap(el.attr('style')) 

        if el.is("box") && styles.color 
          obj.material.setValues { color : styles.color, ambient : styles.color }

        if el.is("box") && styles.textureMap && !obj.material.map
          url = "//" + @getAssetHost() + @getUrlFromStyle(styles.textureMap )

          THREE.ImageUtils.crossOrigin = true

          texture = new THREE.ImageUtils.loadTexture( url )
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set( 1, 1 )

          obj.material.setValues { map : texture }

        if el.is("model") && styles.color
          obj.traverse ( child ) ->
            if child instanceof THREE.Mesh
              child.material.setValues { color : styles.color, ambient : styles.color }
  
module.exports = Connector