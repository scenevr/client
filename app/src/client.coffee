Connector = require("./connector.coffee")

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
    @stats.domElement.style.right = '10px';
    @stats.domElement.style.zIndex = 100;
    @stats.domElement.style.bottom = '10px';
    @container.append(@stats.domElement)

    VIEW_ANGLE = 60
    ASPECT = @width / @height
    NEAR = 0.1
    FAR = 700
    DOWN_SAMPLE = 1

    @scene = new THREE.Scene()
    @scene.fog = new THREE.Fog( 0xffffff, 500, 700 );

    @world = new CANNON.World()
    @world.gravity.set(0,-20,0); # m/s²
    @world.broadphase = new CANNON.NaiveBroadphase()

    @renderer = new THREE.WebGLRenderer( {antialias:false} )
    @renderer.setSize(@width / DOWN_SAMPLE, @height / DOWN_SAMPLE)
    @renderer.shadowMapEnabled = false
    @renderer.setClearColor( 0xeeeeee, 1)

    @initVR()

    # @projector = new THREE.Projector()
    @time = Date.now()

    @addLights()
    @addFloor()
    @addPlayerBody()
    @addDot()
    @addMessageInput()
    @addPointLockGrab()

    @camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR)
    @addControls()

    @connector = new Connector(this, @getHostFromLocation(), @getPathFromLocation())
    @connector.connect()
    @addConnecting()

    @connector.on 'connected', =>
      @addInstructions()

    @connector.on 'disconnected', =>
      @addConnectionError()

    @connector.on 'restarting', =>
      @showMessage("Reconnecting...")

    this.on 'click', @onClick

    axes = new THREE.AxisHelper(2)
    @scene.add(axes)

    @container.append( @renderer.domElement );
    $(@renderer.domElement).css { width : @width, height : @height }

    @tick()

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

  getHostFromLocation: ->
    if window.location.pathname.match /connect.+/
      window.location.pathname.split('/')[2]
    else
      window.location.host.split(":")[0] + ":8080"

  getPathFromLocation: ->
    if window.location.pathname.match /connect.+/
      "/" + window.location.pathname.split('/')[3]
    else
      null

  loadNewScene: (path) ->
    if path.match /^\/\//
      alert '// hrefs not supported yet...'
    else
      # history.replaceState {}, "SceneVR", 
      window.location = "/connect/#{@getHostFromLocation()}#{path}"

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

  # Fixme - the .parent tests are all a bit manky...
  onClick: =>
    @raycaster = new THREE.Raycaster

    position = @controls.getObject().position
    direction = @controls.getDirection(new THREE.Vector3)

    @raycaster.set( position, direction )

    for intersection in @raycaster.intersectObjects( @getAllClickableObjects() ) 
      # For links
      if intersection.object && intersection.object.parent && intersection.object.parent.userData.is && intersection.object.parent.userData.is("link")
        @loadNewScene(intersection.object.parent.userData.attr("href"))

      # Boxes
      if intersection.object.name
        @connector.onClick {
          uuid : intersection.object.name
          point : intersection.point
        }
        return

      # Billboards, models
      if intersection.object.parent && intersection.object.parent.name
        @connector.onClick {
          uuid : intersection.object.parent.name
          point : intersection.point
        }
        return

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
    $("<div />").text("#{player.name}: #{message}").appendTo @chatMessages
    @chatMessages.scrollTop(@chatMessages[0].scrollHeight)

  hideOverlays: ->
    $(".overlay").hide()

  showOverlays: ->
    $(".overlay").show()

  addConnectionError: ->
    $(".overlay").remove()

    @renderOverlay(Templates.unableToConnect({
      server : @connector.host.split(":")[0]
      port : @connector.host.split(":")[1]
    }))

  renderOverlay: (html) ->
    $(".overlay").remove()

    @overlay = $("<div class='overlay'>").html(html).appendTo @container

    @overlay.css {
      left : ($(window).width() - @overlay.width()) / 2
      top : ($(window).height() - @overlay.height()) / 2
    }

  addConnecting: ->
    @renderOverlay(Templates.connecting {
      server : @connector.host.split(":")[0]
      port : @connector.host.split(":")[1]
    })  

  addInstructions: ->
    $(".overlay").remove()

    @renderOverlay(Templates.instructions)

    unless element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock
      alert "[FAIL] Your browser doesn't seem to support pointerlock. Please use ie, chrome or firefox."
      return

  addPointLockGrab: ->
    $('body').click =>
      return if @controls.enabled

      element = document.body

      document.addEventListener( 'pointerlockchange', @pointerlockchange, false )
      document.addEventListener( 'mozpointerlockchange', @pointerlockchange, false )
      document.addEventListener( 'webkitpointerlockchange', @pointerlockchange, false )

      document.addEventListener( 'pointerlockerror', @pointerlockerror, false )
      document.addEventListener( 'mozpointerlockerror', @pointerlockerror, false )
      document.addEventListener( 'webkitpointerlockerror', @pointerlockerror, false )

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

  addFloor: ->
    floorTexture = new THREE.ImageUtils.loadTexture( '/images/grid.png' )
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set( 1000, 1000 )

    floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture } );
    floorGeometry = new THREE.PlaneBufferGeometry(1000, 1000, 1, 1)
    
    @floor = new THREE.Mesh(floorGeometry, floorMaterial)
    @floor.position.y = 0
    @floor.rotation.x = -Math.PI / 2
    @floor.receiveShadow = true

    @scene.add(@floor)

    groundBody = new CANNON.Body { mass: 0 } # static
    groundShape = new CANNON.Plane()
    groundBody.addShape(groundShape)
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
    
    @world.add(groundBody)

  addPlayerBody: ->
    @playerBody = new CANNON.Body { mass : 100 }
    sphereShape = new CANNON.Sphere(0.5)
    @playerBody.addShape(sphereShape)
    @playerBody.position.set(0,0,0)
    @playerBody.linearDamping = 0
    @world.add(@playerBody)

  addDot: ->
    $("<div />").addClass('aiming-point').appendTo 'body'

  addControls: ->
    @controls = new PointerLockControls(@camera, this, @playerBody)
    @controls.enabled = false
    @scene.add(@controls.getObject())

  getPlayerObject: ->
    @controls.getObject()

  addLights: ->
    dirLight = new THREE.DirectionalLight( 0xffffff, 1.1)
    dirLight.position.set( -1, 0.75, 0.92 )

    @scene.add( dirLight )

    ambientLight = new THREE.AmbientLight(0x404040)
    @scene.add(ambientLight)

  getPlayerDropPoint: ->
    v = new THREE.Vector3(0,0,-20)

    @getAvatarObject().position.clone().add(
      v.applyEuler(@getAvatarObject().rotation)
    )

  tick: =>
    @stats.begin()

    timeStep = 1.0/60.0 # seconds
    # Simulate physics
    if @controls.enabled
      @world.step(timeStep)
    # console.log("Sphere z position: " + @sphereBody.position.z)

    # Animate
    TWEEN.update()

    if @vrrenderer
      # VR
      state = @vrHMDSensor.getState()
      @camera.quaternion.set(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w)
      @vrrenderer.render(@scene, @camera, @controls )
    else
      # Render webGL
      @renderer.render( @scene, @camera  )

    # Controls
    @controls.update( Date.now() - @time )

    @stats.end()

    @time = Date.now()

    # Airplane mode
    # setTimeout(@tick, 1000 / 25)
    requestAnimationFrame @tick

module.exports = Client