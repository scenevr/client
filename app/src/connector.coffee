Utils = require "./utils.coffee"
TWEEN = require("tween.js")
EventEmitter = require('wolfy87-eventemitter');
Color = require("color")

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
    # Fixme - if the controls aren't active, the player body isn't copied to the camera
    @client.playerBody.position.copy(v).y = 1.5
    @client.controls.getObject().position.copy(@client.playerBody.position)

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
    window.location.host.split(":")[0]

  getAssetHost: ->
    @getHost() + ":8090"

  createBillboard: (el) ->
    obj = new THREE.Object3D

    canvas = $("<canvas width='256' height='256' />")[0]

    div = $("<div />").html(el.html()).css({ position : 'absolute', left : 0, top : 0, background : 'white', width : 256, height : 256, padding : '10px', border : '1px solid #ccc' })

    div.find("img").each (index, img) =>
      img.src =  "//" + @getAssetHost() + img.getAttribute("src")

    div.appendTo 'body'

    geometry = new THREE.BoxGeometry( 1, 1, 1 )
    material = new THREE.MeshLambertMaterial( {color: '#eeeeee', emissive : '#222222' } )
    box = new THREE.Mesh( geometry, material )

    material = new THREE.MeshLambertMaterial( {color: '#ffffff' } )
    mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), material)
    mesh.position.setZ(0.52)

    html2canvas div[0], {
      useCORS : true
      onrendered: (canvas) =>
        texture = new THREE.Texture(canvas) 
        texture.needsUpdate = true;
        material = new THREE.MeshBasicMaterial( {map: texture, side:THREE.DoubleSide } )
        material.transparent = false;
        mesh.material = material
        div.remove()
    }

    obj.add(box)
    obj.add(mesh)

    newScale = if el.attr("scale")
      Utils.parseVector(el.attr("scale"))
    else
      new THREE.Vector3(2,2,0.5)

    obj.scale.copy(newScale)

    # Add physics model
    boxShape = new CANNON.Box(new CANNON.Vec3().copy(newScale.multiplyScalar(0.5)))
    boxBody = new CANNON.Body({ mass: 0 })
    boxBody.addShape(boxShape)
    @client.world.add(boxBody)
    obj.body = boxBody

    obj

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

  createBox: (el) ->
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
    @client.world.add(boxBody)
    obj.body = boxBody

    obj

  createModel: (el) ->
    obj = new THREE.Object3D
    texture = null

    if el.attr("style")
      styles = @parseStyleAttribute(el.attr("style"))

      if styles['lightmap']
        texture = new THREE.Texture()
        loader = new THREE.ImageLoader( @manager )
        loader.crossOrigin = true
        loader.load "//" + @getAssetHost() + @getUrlFromStyle(styles['lightmap']), ( image ) ->
          texture.image = image
          texture.needsUpdate = true

    material = new THREE.MeshBasicMaterial({ color : '#eeeeee' })
    loader = new THREE.OBJLoader( @manager )
    loader.load "//" + @getAssetHost() + el.attr("src"), ( object ) ->
      object.traverse ( child ) ->
        if child instanceof THREE.Mesh
          child.material = material
          if texture
            child.material.map = texture
      obj.add(object)

    obj 

  createSkyBox: (el) ->
    material = null

    if src = el.attr("src")
      path = "//" + @getAssetHost() + src.replace(/\..+?$/,'')
      format = src.replace(/.+\./,'.')

      urls = [
        path + 'right' + format, path + 'left' + format,
        path + 'top' + format, path + 'bottom' + format,
        path + 'front' + format, path + 'back' + format
      ]

      THREE.ImageUtils.crossOrigin = true
      reflectionCube = THREE.ImageUtils.loadTextureCube( urls )
      reflectionCube.format = THREE.RGBFormat

      shader = THREE.ShaderLib[ "cube" ];
      shader.uniforms[ "tCube" ].value = reflectionCube

      material = new THREE.ShaderMaterial( {
        fragmentShader: shader.fragmentShader,
        vertexShader: shader.vertexShader,
        uniforms: shader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
      } )
    else if color = el.css("color")
      material = new THREE.MeshBasicMaterial( { color : color })
    else
      material = new THREE.MeshBasicMaterial( { color : '#eeeeee' })

    new THREE.Mesh( new THREE.BoxGeometry( 100, 100, 100 ), material );

  getUrlFromStyle: (value) ->
    try
      value.match(/\((.+?)\)/)[1]
    catch e
      null

  parseStyleAttribute: (value) ->
    result = {}

    for pair in value.split(";")
      [name, value] = pair.split(":")
      result[name.trim().toLowerCase()] = value.trim()

    result

  onMessage: (e) =>
    # console.log e.data

    $(e.data).children().each (index, el) =>
      el = $(el)

      if el.is("event")
        name = el.attr("name")

        if name == "ready"
          @uuid = el.attr("uuid")
        else if name == "restart"
          console.log "Got restart message"
          @restartConnection()
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

        if !(obj = @scene.getObjectByName(uuid))
          if el.is("spawn")
            obj = new THREE.Object3D()
            if !@spawned
              @setPosition newPosition
              @spawned = true

          else if el.is("billboard")
            obj = @createBillboard(el)

          else if el.is("box")
            obj = @createBox(el)

          else if el.is("model")
            obj = @createModel(el)

          else if el.is("link")
            obj = @createLink(el)

          else if el.is("skybox")
            obj = @createSkyBox(el)

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

          unless el.is("skybox")
            # skyboxes dont have a position
            obj.position.copy(newPosition)

          if el.is("skybox")
            obj.castShadow = false
          else
            obj.castShadow = true

          @scene.add(obj)

          # Fade in boxes
          if obj.material and el.is("box")
            obj.material.setValues { transparent : true, opacity: 0.5 }

            tween = new TWEEN.Tween({ opacity : 0.0 })
            tween.to({ opacity : 1.0 }, 200)
              .onUpdate(-> obj.material.setValues { opacity : @opacity })
              .onComplete(-> obj.material.setValues { transparent : false })
              .easing(TWEEN.Easing.Linear.None)
              .start()

        if el.attr("style")
          if el.css("visibility") == "hidden"
            obj.visible = false
          else
            obj.visible = true
            window.el = el

          # if el.css("lightmap")
          #   window.el = el

        if el.is("spawn")
          # Don't tween spawn
          obj.position.copy(newPosition)
        else if el.is("box") or el.is("player") or el.is("billboard") or el.is("model") or el.is("link")
          # Tween away
          startPosition = obj.position.clone()

          # Physics simulation isn't tweened
          if obj.body
            obj.body.position.copy(newPosition)

          # Todo - tween rotations
          if el.attr("rotation")
            newRotation = Utils.parseEuler(el.attr("rotation"))
            obj.rotation.copy(newRotation)

            if obj.body
              obj.body.quaternion.copy(new THREE.Quaternion().setFromEuler(newRotation))

          if !startPosition.equals(newPosition)
            tween = new TWEEN.Tween(startPosition)
            tween.to(newPosition, 200)
              .onUpdate(-> obj.position.set(@x, @y, @z))
              .easing(TWEEN.Easing.Linear.None)
              .start()

        if el.is("box") 
          obj.material.setValues { color : el.attr('color'), emissive : Color(el.attr('color')).darken(0.75).hexString() }
  
module.exports = Connector