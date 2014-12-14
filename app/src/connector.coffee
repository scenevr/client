TWEEN = require("tween.js")
EventEmitter = require('wolfy87-eventemitter');
Color = require("color")
Utils = require("./utils.coffee")
Howl = require("howler").Howl

class Connector extends EventEmitter
  constructor: (@client, @scene, @physicsWorld, host, path, isPortal) ->
    @host = host || window.location.host.split(":")[0] + ":8080"
    @path = path || "/index.xml"
    @isPortal = isPortal || false
    @protocol = "scenevr"
    @uuid = null
    @spawned = false
    @manager = new THREE.LoadingManager()

    if @isPortal
      grid = new THREE.GridHelper(100, 1);
      grid.setColors(0xffffff, 0xffffff);
      @scene.add(grid);

  isPortalOpen: ->
    !!@portal

  loadPortal: (el, obj) ->
    if @isPortal
      console.error "Portal tried to #loadPortal"
      return

    @portal = {}
    @portal.el = el
    @portal.obj = obj
    @portal.scene = new THREE.Scene
    @portal.world = new CANNON.World
    @portal.scene.fog = new THREE.Fog( 0x000000, 10, 50 )
    @portal.connector = new Connector(null, @portal.scene, @portal.world, @host, el.attr('href'), true)
    @portal.connector.connect()
    @stencilScene = new THREE.Scene

  closePortal: ->
    @scene.remove(@portal.obj)
    delete @portal
    delete @stencilScene

  createPortal: (el, obj) ->
    @loadPortal(el, obj)

    while obj.children[0]
      obj.remove(obj.children[0])
      
    newPosition = el.attr("position") && Utils.parseVector(el.attr("position"))

    glowTexture = new THREE.ImageUtils.loadTexture( '/images/portal.png' )
    glowTexture.wrapS = glowTexture.wrapT = THREE.RepeatWrapping;
    glowTexture.repeat.set( 1, 1 )

    glowMaterial = new THREE.MeshBasicMaterial( { map: glowTexture, transparent : true } );
    glowGeometry = new THREE.PlaneBufferGeometry(2, 2, 1, 1)
    glow = new THREE.Mesh(glowGeometry, glowMaterial)

    portalMaterial = new THREE.MeshBasicMaterial { color : '#000000' }
    portalGeometry = new THREE.CircleGeometry(1 * 0.75, 40)
    portal = new THREE.Mesh(portalGeometry, portalMaterial)
    portal.position.z = 0.001

    obj.add(glow)
    obj.add(portal)

    portalClone = portal.clone()
    portalClone.position.copy(newPosition)
    portalClone.position.z += 0.1
    portalClone.visible = true
    portalClone.updateMatrix()
    portalClone.updateMatrixWorld(true)
    portalClone.matrixAutoUpdate = false
    portalClone.frustumCulled = false

    @stencilScene.add(portalClone)

    obj

  setPosition: (v) ->
    if @client
      @client.playerBody.position.copy(v)
      @client.playerBody.position.y += 1.5
      @client.playerBody.velocity.set(0,0,0)
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

    if @client
      @client.removeReflectedObjects()

    clearInterval @interval
    setTimeout(@reconnect, 500)

  connect: ->
    console.log "Connecting"
    @ws = new WebSocket("ws://#{@host}#{@path}", @protocol);
    @ws.binaryType = 'arraybuffer'
    @ws.onopen = =>
      console.log "Socket connected"
      if @client
        @interval = setInterval @tick, 1000 / 5
      @trigger 'connected'
    @ws.onclose = =>
      console.log "Socket opened"
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
    @client.getHostFromLocation()

  getAssetHost: ->
    @getHost()

  createBillboard: (el) ->
    SIZE = 512

    obj = new THREE.Object3D

    canvas = $("<canvas width='#{SIZE}' height='#{SIZE}' />")[0]

    div = $("<div />").html(el.html()).css({ position : 'absolute', left : 0, top : 0, background : 'white', width : SIZE, height : SIZE, padding : '10px', border : '1px solid #ccc', zIndex : 10 })

    div.find("img").each (index, img) =>
      img.src =  "//" + @getAssetHost() + img.getAttribute("src")

    div.appendTo 'body'

    geometry = new THREE.BoxGeometry( 1, 1, 1 )
    material = new THREE.MeshLambertMaterial( {color: '#eeeeee', ambient: '#eeeeee' } )
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
        unless @isPortal
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
    @physicsWorld.add(boxBody)
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

    geometry2 = new THREE.SphereGeometry( 0.25, 16, 16 )
    material2 = new THREE.MeshPhongMaterial( {color: '#ff7700', emissive : '#aa3300', transparent : true, opacity: 0.5 } )
    obj.add(new THREE.Mesh( geometry2, material2 ))

    geometry = new THREE.SphereGeometry( 0.12, 16, 16 )
    material = new THREE.MeshPhongMaterial( {color: '#ff7700', emissive : '#aa3300' } )
    obj.add(new THREE.Mesh( geometry, material ))

    obj.onClick = =>
      console.log "eh?"
      if @portal && @portal.obj == obj
        @closePortal()
      else if @portal
        @closePortal()
        @createPortal(el, obj)
      else
        @createPortal(el, obj)

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
    @physicsWorld.add(boxBody)
    obj.body = boxBody

    obj

  createModel: (el) ->
    obj = new THREE.Object3D
    texture = null

    styles = @parseStyleAttribute(el.attr("style"))

    material = if styles['texturemap']
        new THREE.MeshLambertMaterial({ color : '#ff0000' })
      else
        new THREE.MeshBasicMaterial({ color : '#eeeeee' })

    if el.attr("style")
      if styles['lightmap'] || styles['texturemap']
        texture = new THREE.Texture()
        loader = new THREE.ImageLoader( @manager )
        loader.crossOrigin = true
        loader.load "//" + @getAssetHost() + @getUrlFromStyle(styles['lightmap'] || styles['texturemap']), ( image ) ->
          texture.image = image
          texture.magFilter = THREE.NearestFilter
          texture.needsUpdate = true
          material.needsUpdate = true
      else if styles['color']
        material = new THREE.MeshLambertMaterial({ color : styles['color'] })

    loader = new THREE.OBJLoader( @manager )
    loader.load "//" + @getAssetHost() + el.attr("src"), ( object ) ->
      object.traverse ( child ) ->
        if child instanceof THREE.Mesh
          child.material = material
          if texture
            child.material.map = texture
      obj.add(object)

    newScale = if el.attr("scale")
      Utils.parseVector(el.attr("scale"))
    else
      new THREE.Vector3(1,1,1)

    obj.scale.copy(newScale)

    obj 

  createAudio: (el) ->
    obj = new THREE.Object3D

    if (src = el.attr("src")) and el.attr("ambient").toLowerCase() == "true"
      path = "//" + @getAssetHost() + src

      volume = if el.attr("volume")
          parseFloat(el.attr("volume"))
        else
          1.0

      obj.userSound = new Howl({
        urls: [path]
        loop: true
        volume: volume
      }).play();

    obj.position = new THREE.Vector3(0,0,0)

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
    else if color = @parseStyleAttribute(el.attr('style')).color
      if color.match /linear-gradient/

        [start, finish] = color.match(/#.+?\b/g)

        vertexShader = "
          varying vec3 vWorldPosition;

          void main() {

            vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
            vWorldPosition = worldPosition.xyz;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

          }
        "

        fragmentShader = "
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;

          varying vec3 vWorldPosition;

          void main() {

            float h = normalize( vWorldPosition + offset ).y;
            gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );

          }
        "

        uniforms = {
          topColor:    { type: "c", value: new THREE.Color( finish ) },
          bottomColor: { type: "c", value: new THREE.Color( start ) },
          offset:    { type: "f", value: 0 },
          exponent:  { type: "f", value: 0.6 }
        }

        # Fixme - random probably bad assumption
        @scene.fog = new THREE.Fog( 0xffffff, 10, 50 )
        @scene.fog.color.copy( uniforms.bottomColor.value )

        material = new THREE.ShaderMaterial( {
          uniforms: uniforms,
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
          side: THREE.BackSide
        } )
      else
        material = new THREE.MeshBasicMaterial( { color : color, side : THREE.BackSide })
    else
      material = new THREE.MeshBasicMaterial( { color : '#eeeeee', side : THREE.BackSide })

    new THREE.Mesh( new THREE.BoxGeometry( 200, 200, 200 ), material );

  getUrlFromStyle: (value) ->
    try
      value.match(/\((.+?)\)/)[1]
    catch e
      null

  parseStyleAttribute: (value) ->
    result = {}

    if value
      for pair in value.split(";")
        [name, value] = pair.split(":")
        result[name.trim().toLowerCase()] = value.trim()

    result

  onMessage: (e) =>
    # console.log e.data

    # console.log e.data

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

          if @isPortal
            obj.traverse (child) -> 
              child.material = new THREE.MeshBasicMaterial { wireframe : true, color : '#ffffff' }

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
          styles = @parseStyleAttribute(el.attr("style"))

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
          unless @isPortal
            obj.material.setValues { color : el.attr('color'), ambient : Color(el.attr('color')).hexString() }
  
module.exports = Connector