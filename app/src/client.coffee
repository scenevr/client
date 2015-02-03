Connector = require("./connector.coffee")
URI = require("uri-js")

Templates = {
  inQueue : require("../templates/in_queue.jade")
  unableToConnect : require("../templates/unable_to_connect.jade")
  instructions : require("../templates/instructions.jade")
  connecting : require("../templates/connecting.jade")
}

# fixme - do we have to export to window? bit gross.
window.CANNON = require("cannon")

TWEEN = require("tween.js")
EventEmitter = require('wolfy87-eventemitter');
DOWN_SAMPLE = 1
PHYSICS_HZ = 60.0 # Physics hertz

MOBILE = false
DOWN_SAMPLE = 1

if /Android|iPhone|iPad|iPod|IEMobile/i.test(navigator.userAgent)
  MOBILE = true

class Client extends EventEmitter
  constructor: ->
    @container = $("#scene-view").css {
      position : 'relative'
    }

    @width = @container.width()
    @height = @container.height()

    @stats = new Stats()
    @stats.setMode(0)

    @stats.domElement.style.position = 'absolute';
    @stats.domElement.style.top = '10px';
    @stats.domElement.style.zIndex = 110;
    @stats.domElement.style.left = '10px';

    @container.append(@stats.domElement)

    VIEW_ANGLE = 60
    ASPECT = @width / @height
    NEAR = 0.1
    FAR = 700

    @scene = new THREE.Scene()

    @world = new CANNON.World()
    @world.gravity.set(0,-20,0); # m/s²
    @world.broadphase = new CANNON.NaiveBroadphase()

    @renderer = new THREE.WebGLRenderer( { antialias : false } )
    @renderer.setSize(@width / DOWN_SAMPLE, @height / DOWN_SAMPLE)
    @renderer.setClearColor( 0x000000)
    @renderer.autoClear = false

    @initVR()

    @time = Date.now()

    if !MOBILE
      @addMessageInput()
      @addPointLockGrab()

    @camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR)
    @addControls()
    @addPlayerBody()
    @addDot()

    @connector = new Connector(this, @scene, @world, @getUriFromLocation())
    @connector.connect()
    
    @addConnecting()

    @connector.on 'connected', =>
      if MOBILE
        @enableControls()
      else
        @addInstructions()

    @connector.on 'disconnected', =>
      @addConnectionError()

    @connector.on 'restarting', =>
      @showMessage("Reconnecting...")

    this.on 'click', @onClick

    @raycaster = new THREE.Raycaster

    @container.append( @renderer.domElement );
    $(@renderer.domElement).css { width : @width, height : @height }

    @tick()

    setInterval(@tickPhysics, 1000 / PHYSICS_HZ)

    window.addEventListener( 'resize', @onWindowResize, false )

    window.addEventListener "keypress", (e) =>
      if (e.charCode == 'r'.charCodeAt(0)) and @vrrenderer and @controls.enabled
        @vrrenderer.resetOrientation(@controls, @vrHMDSensor)

      if (e.charCode == 'f'.charCodeAt(0)) and @vrrenderer and @controls.enabled
        if @renderer.domElement.mozRequestFullScreen
          @renderer.domElement.mozRequestFullScreen {
            vrDisplay: vrHMD
          }
        if @renderer.domElement.webkitRequestFullscreen
          @renderer.domElement.webkitRequestFullscreen {
            vrDisplay : @vrHMD
          } 

  onWindowResize: =>
    @width = @container.width()
    @height = @container.height()
    
    $(@renderer.domElement).css { width : @width, height : @height }

    @camera.aspect = @width / @height
    @camera.updateProjectionMatrix()

    @renderer.setSize(@width / DOWN_SAMPLE, @height / DOWN_SAMPLE)

    @centerOverlay()

  hasPointerLock: ->
    document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement

  pointerlockerror: (event) =>
    alert "[FAIL] There was an error acquiring pointerLock. You will not be able to use sceneserver."

  pointerlockchange: (event) =>
    if @hasPointerLock()
      @enableControls()
    else
      @disableControls()

  enableControls: ->
    @controls.enabled = true
    @hideInstructions()

  disableControls: ->
    @controls.enabled = false
    @showInstructions()

  getUriFromLocation: ->
    if window.location.search.match /connect.+/
      "//" + window.location.search.split(/[=]/)[1]
    else
      "//scenevr-demo.herokuapp.com/index.xml"

  removeReflectedObjects: ->
    list = for obj in @scene.children when obj.name
      obj

    for obj in list
      @scene.remove(obj)
      if obj.body
        @world.remove(obj.body)
      
  getAllClickableObjects: ->
    list = []

    @scene.traverse (obj) ->
      list.push(obj)

    list

  initVR: ->
    if (navigator.getVRDevices)
      navigator.getVRDevices().then(@vrDeviceCallback)
    else if (navigator.mozGetVRDevices)
      navigator.mozGetVRDevices(@vrDeviceCallback)

  vrDeviceCallback: (vrdevs) =>
    for device in vrdevs
      if device instanceof HMDVRDevice
        @vrHMD = device
        break

    for device in vrdevs
      if device instanceof PositionSensorVRDevice && device.hardwareUnitId == @vrHMD.hardwareUnitId
        @vrHMDSensor = device
        break

    if @vrHMD
      @vrrenderer = new THREE.VRRenderer(@renderer, @vrHMD)

  checkForPortalCollision: ->
    position = @controls.getObject().position
    direction = @controls.getDirection(new THREE.Vector3)

    @raycaster.set( position, direction )
    @raycaster.far = 0.5
    
    ints = @raycaster.intersectObject(@connector.stencilScene.children[0], false)

    if (ints.length > 0)
      @promotePortal()

  promotePortal: ->
    # Promote the portal scene to the primary scene
    @portal = @connector.portal

    window.history.pushState {}, "SceneVR", "?connect=" + @portal.connector.uri.replace(/^\/\//,'')

    controlObject = @controls.getObject()

    @scene.remove(controlObject)
    @world.remove(@playerBody)

    @world = @portal.world
    @scene = @portal.scene
    
    @scene.add(controlObject)

    @connector.disconnect()
    delete @connector

    @connector = @portal.connector
    @connector.isPortal = false

    delete @portal
    delete @playerBody

    @world.gravity.set(0,-20,0); # m/s²
    @world.broadphase = new CANNON.NaiveBroadphase()

    @addPlayerBody()

    # Spawn at the spawn point
    @connector.setPosition(@connector.spawnPosition)



  # Fixme - the .parent tests are all a bit manky...
  onClick: =>
    position = @controls.getObject().position
    direction = @controls.getDirection(new THREE.Vector3)

    @raycaster.set( position, direction )
    @raycaster.far = 5.0

    for intersection in @raycaster.intersectObjects( @getAllClickableObjects() ) 
      # For links
      if intersection.object && intersection.object.parent && intersection.object.parent.userData.is && intersection.object.parent.userData.is("link")
        intersection.object.parent.onClick()

      # Other types
      obj = intersection.object

      while obj.parent
        if obj.userData instanceof jQuery
          @connector.onClick {
            uuid : obj.name
            point : intersection.point
          }
          return

        obj = obj.parent

  addMessageInput: ->
    @chatForm = $("<div id='message-input'>
      <input type='text' placeholder='Press enter to start chatting...' />
    </div>").appendTo("body")

    input = @chatForm.find('input')

    $('body').on 'keydown', (e) =>
      if e.keyCode == 13 and !input.is(":focus")
        @chatForm.find('input').focus()
        @controls.enabled = false

      if e.keyCode == 27
        @disableControls()

    input.on 'keydown', (e) =>
      if e.keyCode == 13
        @addChatMessage({ name : 'You'}, input.val())
        @connector.sendChat input.val()
        input.val("").blur()
        @enableControls()

        e.preventDefault()
        e.stopPropagation()

    @chatMessages = $("<div id='messages' />").hide().appendTo 'body'

  addChatMessage: (player, message) ->
    @chatMessages.show()

    if player is null || player.name is 'scene'
      $("<div />").text("#{message}").addClass('scene-message').appendTo @chatMessages
    else
      $("<div />").text("#{player.name}: #{message}").appendTo @chatMessages

    @chatMessages.scrollTop(@chatMessages[0].scrollHeight)

  hideOverlays: ->
    $(".overlay").hide()

  showOverlays: ->
    $(".overlay").show()

  addConnectionError: ->
    $(".overlay").remove()

    @renderOverlay(Templates.unableToConnect({
      host : URI.parse(@connector.uri).host
    }))

  renderOverlay: (html) ->
    $(".overlay").remove()

    @overlay = $("<div class='overlay'>").html(html).appendTo @container

    @centerOverlay()

  centerOverlay: ->
    if @overlay
      @overlay.css {
        left : ($(window).width() - @overlay.width()) / 2 - 20
        top : ($(window).height() - @overlay.height()) / 2
      }

  addConnecting: ->
    @renderOverlay(Templates.connecting {
      host : URI.parse(@connector.uri).host
    })  

  addInstructions: ->
    $(".overlay").remove()

    @renderOverlay(Templates.instructions)

    element = document.body

    unless MOBILE || element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock
      alert "[FAIL] Your browser doesn't seem to support pointerlock. Please use ie, chrome or firefox."
      return

  addPointLockGrab: ->
    $('body').click =>
      return if @controls.enabled

      document.addEventListener( 'pointerlockchange', @pointerlockchange, false )
      document.addEventListener( 'mozpointerlockchange', @pointerlockchange, false )
      document.addEventListener( 'webkitpointerlockchange', @pointerlockchange, false )

      document.addEventListener( 'pointerlockerror', @pointerlockerror, false )
      document.addEventListener( 'mozpointerlockerror', @pointerlockerror, false )
      document.addEventListener( 'webkitpointerlockerror', @pointerlockerror, false )

      element = document.body
      element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
      element.requestPointerLock()

  # Fixme - make some kind of overlay class
  showMessage: (message) ->
    @renderOverlay(message)

  showInstructions: ->
    @addInstructions()

  hideInstructions: ->
    $(".overlay").remove()

  addLoadingScene: ->
    geometry = new THREE.IcosahedronGeometry(500, 3)
    material = new THREE.MeshBasicMaterial {
      color: '#999999',
      wireframe: true,
      wireframeLinewidth: 1
    }
    @loadingDome = new THREE.Mesh(geometry, material)
    @scene.add(@loadingDome)

  addPlayerBody: ->
    @playerBody = new CANNON.Body { mass : 100 }
    sphereShape = new CANNON.Sphere(0.5)
    @playerBody.addShape(sphereShape)
    @playerBody.position.set(0,0,0)
    @playerBody.linearDamping = 0
    @world.add(@playerBody)

    @controls.setCannonBody(@playerBody)

    lastContact = {
      time : 0
      uuid : null
    }

    @playerBody.addEventListener "collide", (e) =>
      contact = e.contact

      # contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
      # We do not yet know which one is which! Let's check.
      other = if contact.bi.id == @playerBody.id
          contact.bj
        else
          contact.bi

      if other.uuid
        if ((new Date) - lastContact.time < 500) && (lastContact.uuid is other.uuid)
          # We only send updates on the same element that aren't too close together, so skip this update
          true
        else
          # Keep track of the last contact
          lastContact = { time : new Date, uuid : other.uuid }

          # Fixme - only send updates up to a maximum of x / second using a trailing
          # average, to prevent weird physics bugs spamming the server.
          @connector.onCollide { uuid : other.uuid, normal : contact.ni }

  addDot: ->
    $("<div />").addClass('aiming-point').appendTo 'body'

  addControls: ->
    @controls = new PointerLockControls(@camera, this, MOBILE)
    @controls.enabled = false
    @scene.add(@controls.getObject())

  getPlayerObject: ->
    @controls.getObject()

  getPlayerDropPoint: ->
    v = new THREE.Vector3(0,0,-20)

    @getAvatarObject().position.clone().add(
      v.applyEuler(@getAvatarObject().rotation)
    )

  tickPhysics: =>
    timeStep = 1.0 / PHYSICS_HZ # seconds

    # Simulate physics
    if @controls.enabled
      @connector.physicsWorld.step(timeStep)

    # Animate and tween physics models
    TWEEN.update()

    # Controls
    @controls.update( Date.now() - @time )
    @time = Date.now()

  tick: =>
    @stats.begin()

    if @vrrenderer
      # VR
      state = @vrHMDSensor.getState()
      @camera.quaternion.set(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w)
      @vrrenderer.render(@scene, @camera, @controls )
    else
      # Render webGL
      # @renderer.render( @connector.portal.scene, @camera  )

      if @connector.isPortalOpen()
        @checkForPortalCollision()  
      #   @renderPortals()      

      @renderer.render( @scene, @camera  )

    @stats.end()

    # Airplane mode
    # setTimeout(@tick, 1000 / 25)
    requestAnimationFrame @tick

  renderPortals: ->
    gl = @renderer.context;

    originalCameraMatrixWorld = new THREE.Matrix4()
    originalCameraProjectionMatrix = new THREE.Matrix4()
    
    # cameraObject.updateMatrix();
    # cameraObject.updateMatrixWorld();

    originalCameraMatrixWorld.copy(@camera.matrixWorld);
    originalCameraProjectionMatrix.copy(@camera.projectionMatrix);
    
    # 1: clear scene (autoClear is disabled)
    @renderer.clear(true, true, true);
    
    # 2: draw portal mesh into stencil buffer
    gl.colorMask(false, false, false, false);
    gl.depthMask(false);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(0xFF);
    gl.stencilFunc(gl.NEVER, 0, 0xFF);
    gl.stencilOp(gl.INCR, gl.KEEP, gl.KEEP);
    
    @renderer.render(@connector.stencilScene, @camera);
    
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

    # 3: draw toScene on scencil
    @renderer.clear(false, true, false);

    gl.stencilFunc(gl.LESS, 0, 0xff);

    # camera.matrixWorld.copy(getPortalViewMatrix(camera, currentPortal, otherPortal));
    # camera.matrixWorldInverse.getInverse(camera.matrixWorld);

    #getPortalProjectionMatrix(camera, otherPortal);
    
    @renderer.render(@connector.portal.scene, @camera);

    gl.disable(gl.STENCIL_TEST);
    
    @renderer.clear(false, false, true);

    # 4: draw fromScene.
    @camera.matrixWorld.copy(originalCameraMatrixWorld);
    @camera.projectionMatrix.copy(originalCameraProjectionMatrix);

    # clear the depth buffer and draw the fromPortal mesh into it
    @renderer.clear(false, true, false);

    gl.colorMask(false, false, false, false);
    gl.depthMask(true);
    
    @renderer.render(@connector.stencilScene, @camera);

    # draw the actual scene
    gl.colorMask(true, true, true, true);
    gl.depthMask(true); 
    gl.enable(gl.DEPTH_TEST)
    
    @renderer.render(@scene, @camera);

    @camera.projectionMatrix.copy(originalCameraProjectionMatrix);

module.exports = Client