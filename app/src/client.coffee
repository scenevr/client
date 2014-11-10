Connector = require("./connector")
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
    @stats.domElement.style.left = '10px';
    @stats.domElement.style.top = '10px';
    @container.append(@stats.domElement)

    VIEW_ANGLE = 45
    ASPECT = @width / @height
    NEAR = 0.1
    FAR = 700

    @scene = new THREE.Scene()
    @scene.fog = new THREE.Fog( 0xffffff, 500, 700 );

    @renderer = new THREE.WebGLRenderer( {antialias:false} )
    @renderer.setSize(@width, @height)
    @renderer.shadowMapEnabled = false
    @renderer.setClearColor( 0xffffff, 1)

    # @projector = new THREE.Projector()
    @time = Date.now()

    @addLights()
    @addFloor()

    @camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR)
    @addControls()

    @connector = new Connector(this)
    @connector.connect()
    @addConnecting()

    @connector.on 'connected', =>
      @addInstructions()

    @connector.on 'disconnected', =>
      @addConnectionError()

    this.on 'click', @onClick

    axes = new THREE.AxisHelper(2)
    @scene.add(axes)

    @container.append( @renderer.domElement );

    @tick()

  hasPointerLock: ->
    document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement

  pointerlockerror: (event) =>
    alert "[FAIL] There was an error acquiring pointerLock. You will not be able to use sceneserver."

  pointerlockchange: (event) =>
    if @hasPointerLock()
      @controls.enabled = true
      @showBlocker()
      @hideInstructions()
    else
      @controls.enabled = false
      @showInstructions()
      @hideBlocker()

  onClick: =>
    @raycaster = new THREE.Raycaster
    @raycaster.set( @controls.getObject().position, @controls.getDirection(new THREE.Vector3) )

    for intersection in @raycaster.intersectObjects( @scene.children ) when intersection.object.name
      @connector.onClick {
        uuid : intersection.object.name
        point : intersection.point
      }
      return

  hideOverlays: ->
    $(".overlay").hide()

  showOverlays: ->
    $(".overlay").show()

  addConnectionError: ->
    $(".overlay").remove()

    @overlay = $("<div id='connecting' class='overlay'>
      <h1>Unable to connect to //#{@connector.host}:#{@connector.port}</h1>
    </div>").appendTo(@container)

  addConnecting: ->
    $(".overlay").remove()

    @overlay = $("<div id='connecting' class='overlay'>
      <h1>Connecting to //#{@connector.host}:#{@connector.port}...</h1>
    </div>").appendTo(@container)

  addInstructions: ->
    $(".overlay").remove()

    @overlay = $('<div id="instructions" class="overlay">
      <h1>Click to join</h1>

      <!--div class="keys">
        <span class="key w">W</span>
        <span class="key a">A</span>
        <span class="key s">S</span>
        <span class="key d">D</span>
      </div-->

      <small>
        (W, A, S, D = Move, MOUSE = Look around)
      </small>
    </div>').appendTo(@container)

    @overlay.show().click =>
      # if !@hasPointerLock()
      #   alert "[FAIL] Your browser doesn't seem to support pointerlock. You will not be able to use sceneserver."
      # else

      element = document.body

      document.addEventListener( 'pointerlockchange', @pointerlockchange, false )
      document.addEventListener( 'mozpointerlockchange', @pointerlockchange, false )
      document.addEventListener( 'webkitpointerlockchange', @pointerlockchange, false )

      document.addEventListener( 'pointerlockerror', @pointerlockerror, false )
      document.addEventListener( 'mozpointerlockerror', @pointerlockerror, false )
      document.addEventListener( 'webkitpointerlockerror', @pointerlockerror, false )

      element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
      element.requestPointerLock()

  showBlocker: ->
    @blockerElement ||= $("<div />").addClass("blocker").appendTo 'body'
    @blockerElement.show()

  hideBlocker: ->
    if @blockerElement
      @blockerElement.hide()

  showInstructions: ->
    $("#instructions").show()

  hideInstructions: ->
    $("#instructions").hide()

  addFloor: ->
    floorTexture = new THREE.ImageUtils.loadTexture( '/images/grid.png' )
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set( 100, 100 )

    floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture } );
    floorGeometry = new THREE.PlaneGeometry(100, 100, 1, 1)
    
    @floor = new THREE.Mesh(floorGeometry, floorMaterial)
    @floor.position.y = 0
    @floor.rotation.x = -Math.PI / 2
    @floor.receiveShadow = true

    @scene.add(@floor)

  addControls: ->
    @controls = new THREE.PointerLockControls(@camera, @)
    @controls.enabled = false
    @scene.add(@controls.getObject())

  getPlayerObject: ->
    @controls.getObject()

  addLights: ->
    dirLight = new THREE.DirectionalLight( 0xffffff, 1.0)
    dirLight.position.set( -1, 0.75, 1 )
    dirLight.position.multiplyScalar( 200)
    dirLight.name = "dirlight"
    dirLight.castShadow = true;
    dirLight.shadowMapWidth = dirLight.shadowMapHeight = 256

    @scene.add( dirLight )

    ambientLight = new THREE.AmbientLight(0x111111)
    @scene.add(ambientLight)

  getPlayerDropPoint: ->
    v = new THREE.Vector3(0,0,-20)

    @getAvatarObject().position.clone().add(
      v.applyEuler(@getAvatarObject().rotation)
    )

  tick: =>
    @stats.begin()

    TWEEN.update()

    @controls.update( Date.now() - @time )
    @renderer.render( @scene, @camera )

    @stats.end()

    @time = Date.now()

    # Airplane mode
    # setTimeout(@tick, 1000 / 25)
    requestAnimationFrame @tick

module.exports = Client