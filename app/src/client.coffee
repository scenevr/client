Connector = require("./connector")

class Client
  constructor: ->
    @container = $("#scene-view").css {
      position : 'relative'
    }

    @connector = new Connector(this, @scene, @camera)
    @connector.connect()
    
    @width = @container.width()
    @height = @container.height()

    @stats = new Stats()
    @stats.setMode(0)

    @stats.domElement.style.position = 'absolute';
    @stats.domElement.style.left = '0px';
    @stats.domElement.style.top = '0px';
    @container.append(@stats.domElement)

    VIEW_ANGLE = 45
    ASPECT = @width / @height
    NEAR = 0.1
    FAR = 700

    @scene = new THREE.Scene()
    @scene.fog = new THREE.Fog( 0xffffff, 500, 700 );

    @camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR)
    @camera.position.set(0,10,0)
    @scene.add(@camera)

    @renderer = new THREE.WebGLRenderer( {antialias:true} )
    @renderer.setSize(@width, @height)
    @renderer.shadowMapEnabled = true
    @renderer.setClearColor( 0xffffff, 1)

    @projector = new THREE.Projector()
    @time = Date.now()

    @addLights()
    @addFloor()
    @addControls()
    @addInstructions()

    axes = new THREE.AxisHelper(10)
    @scene.add(axes)

    @container.append( @renderer.domElement );

    @tick()

  hasPointerLock: ->
    document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement

  pointerlockerror: (event) =>
    alert "[FAIL] There was an error acquiring pointerLock. You will not be able to use metaverse.sh."

  pointerlockchange: (event) =>
    if @hasPointerLock()
      @controls.enabled = true
      @showBlocker()
      @hideInstructions()
    else
      @controls.enabled = false
      @showInstructions()
      @hideBlocker()

  hideOverlays: ->
    @instructions.hide()

  showOverlays: ->
    @instructions.show()

  addInstructions: ->
    @instructions = $('<div id="instructions" class="overlay">
      <h1>Click to play</h1>

      <div class="keys">
        <span class="key w">W</span>
        <span class="key a">A</span>
        <span class="key s">S</span>
        <span class="key d">D</span>
      </div>

      <small>
        (W, A, S, D = Move, MOUSE = Look around)
      </small>
    </div>').appendTo(@container)

    @instructions.show().click =>
      # if !@hasPointerLock()
      #   alert "[FAIL] Your browser doesn't seem to support pointerlock. You will not be able to use metaverse.sh."
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
    floorGeometry = new THREE.PlaneGeometry(1000, 1000, 1, 1)
    
    @floor = new THREE.Mesh(floorGeometry, floorMaterial)
    @floor.position.y = 0
    @floor.rotation.x = -Math.PI / 2
    @floor.receiveShadow = true

    @scene.add(@floor)

  addControls: ->
    @controls = new THREE.PointerLockControls ( @camera )
    @controls.enabled = false
    @scene.add(@controls.getObject())

  getAvatarObject: ->
    @controls.getObject()

  addLights: ->
    dirLight = new THREE.DirectionalLight( 0xffffff, 1.0)
    dirLight.position.set( -1, 0.75, 1 )
    dirLight.position.multiplyScalar( 200)
    dirLight.name = "dirlight"

    @scene.add( dirLight )

    dirLight.castShadow = true;
    dirLight.shadowMapWidth = dirLight.shadowMapHeight = 512;

    ambientLight = new THREE.AmbientLight(0x111111)
    @scene.add(ambientLight)

  generateMesh: (element) ->
    element.tmodel = {} # some kind of stub - maybe a Promise?

    loader = new THREE.JSONLoader
    loader.crossOrigin = ""

    if element instanceof Box
      material = new THREE.MeshLambertMaterial( { color: 0xFF00aa } )
      cubeGeometry = new THREE.CubeGeometry(1, 1, 1, 1, 1, 1)
      mesh = new THREE.Mesh(cubeGeometry, material)
      mesh.castShadow = true
      @scene.add(mesh) 
      element.tmodel = mesh

    if element instanceof Model
      loader.load element.src, (geometry, materials) =>
        material = new THREE.MeshFaceMaterial( materials )
        mesh = new THREE.Mesh(geometry,material)
        mesh.castShadow = true
        @scene.add(mesh)
        element.tmodel = mesh

  getPlayerDropPoint: ->
    v = new THREE.Vector3(0,0,-20)

    @getAvatarObject().position.clone().add(
      v.applyEuler(@getAvatarObject().rotation)
    )

  detectCollision: (x,y) ->
    vector = new THREE.Vector3( ( x / @width ) * 2 - 1, - ( y / @height ) * 2 + 1, 0.5 )

    console.log @camera

    @projector.unprojectVector( vector, @camera )
    raycaster = new THREE.Raycaster( @camera.position, vector.sub( @camera.position ).normalize() )
    intersects = raycaster.intersectObjects([@floor])

    for i in intersects
      return i.point

    console.log 'sadface'

  assetServerHost: ->
    window.location.host.split(':')[0] + ":8090"

  addHomer: ->
    loader = new THREE.JSONLoader

    # loader.load "//#{@assetServerHost()}/models/homer.js", (geometry, materials) =>
    loader.load '/public/models/homer.js', (geometry, materials) =>
      material = new THREE.MeshFaceMaterial( materials )

      # create a mesh with models geometry and material
      mesh = new THREE.Mesh(
        geometry,
        material
      )
      #   material
      # )
      
      mesh.rotation.y = -Math.PI/2
      mesh.castShadow = true
      mesh.scale.x = mesh.scale.y = mesh.scale.z = 40.0
      
      @scene.add(mesh)

      @selectModel(mesh)

  appendElement: (element) ->
    @addModel element.getSrcUrl(), element.position
    
  addModel: (url, position) ->
    loader = new THREE.JSONLoader

    loader.load url, (geometry, material) =>
      # console.log(material)

      # if !material
      #   material = new THREE.MeshLambertMaterial( { color: 0xDDDDDD } )
      
      # create a mesh with models geometry and material
      mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshFaceMaterial(material)
      )
      
      mesh.rotation.y = -Math.PI/2
      mesh.castShadow = true
      mesh.position = position
      mesh.scale.x = mesh.scale.y = mesh.scale.z = 10.0
      
      window.mesh = mesh
      
      @scene.add(mesh)

      @selectModel(mesh)

  selectModel: (mesh) ->
    return

    gui = new dat.GUI()

    f1 = gui.addFolder('Rotation')
    f1.add(mesh.rotation, 'x', -Math.PI, Math.PI)
    f1.add(mesh.rotation, 'y', -Math.PI, Math.PI)
    f1.add(mesh.rotation, 'z', -Math.PI, Math.PI)

    range = 250
    f2 = gui.addFolder('Position')
    f2.add(mesh.position, 'x', mesh.position.x - range, mesh.position.x + range)
    f2.add(mesh.position, 'y', mesh.position.y - range, mesh.position.y + range)
    f2.add(mesh.position, 'z', mesh.position.z - range, mesh.position.z + range)

    min = 0.1
    max = 100
    f3 = gui.addFolder('Scale')
    f3.add(mesh.scale, 'x', min, max)
    f3.add(mesh.scale, 'y', min, max)
    f3.add(mesh.scale, 'z', min, max)


  addSuzanne: (position) ->
    loader = new THREE.ColladaLoader()
    loader.options.convertUpAxis = true
    loader.load '/public/models/suzanne.dae', (collada) =>
      for model in collada.scene.children when model instanceof THREE.Mesh
        # skin = collada.skins[0]
        model.scale.x = model.scale.y = model.scale.z = 20.0
        model.rotation.x = Math.PI / 2
        model.position = position
        model.castShadow = true
        # dae.updateMatrix()
        @scene.add(model)
        # alert "?"


  tick: =>
    @stats.begin()

    # Animate between network updates
    # TWEEN.update()

    for key, element of @scene.childNodes
      if !element.tmodel
        @generateMesh(element)

      element.tmodel.position = element.position
      element.tmodel.rotation = element.rotation
      element.tmodel.scale = element.scale

    # @controls.update()
    @controls.update( Date.now() - @time )
    @renderer.render( @scene, @camera )

    @stats.end()

    @time = Date.now()

    requestAnimationFrame @tick

module.exports = Client