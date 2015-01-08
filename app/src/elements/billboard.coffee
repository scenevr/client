Element = require "./element.coffee"

SIZE = 512
DEFAULT_COLOR = '#eeeeee'
TEXTURE_COLOR = '#ffffff'

class Billboard extends Element
  create: ->
    canvas = $("<canvas width='#{SIZE}' height='#{SIZE}' />")[0]

    div = $("<div />").html(@el.text()).css({ 
      fontSize: '22px', 
      zIndex : 50, 
      position : 'absolute', 
      left : 0, 
      top : 0, 
      background : 'white', 
      width : SIZE, 
      height : SIZE, 
      padding : '10px', 
      border : '1px solid #ccc' 
    })

    div.find("img").each (index, img) =>
      img.src = @resolveURI(img.getAttribute("src"))

    div.appendTo 'body'

    geometry = new THREE.BoxGeometry( 1, 1, 1 )
    material = new THREE.MeshLambertMaterial( {color: DEFAULT_COLOR } )
    box = new THREE.Mesh( geometry, material )

    material = new THREE.MeshLambertMaterial( {color: TEXTURE_COLOR } )
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

    @obj = new THREE.Object3D
    @obj.add(box)
    @obj.add(mesh)
    @obj.scale.copy(@getScale())
    @createPhysicsModel()
    @obj

  createPhysicsModel: ->
    boxShape = new CANNON.Box(new CANNON.Vec3().copy(@getScale().multiplyScalar(0.5)))
    boxBody = new CANNON.Body({ mass: 0 })
    boxBody.addShape(boxShape)
    @obj.body = boxBody

  module.exports = Billboard