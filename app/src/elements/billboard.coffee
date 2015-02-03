Utils = require "../utils.coffee"

class Billboard
  constructor: ->
    true

SIZE = 512

Billboard.create = (connector, el) ->
  obj = new THREE.Object3D

  canvas = $("<canvas width='#{SIZE}' height='#{SIZE}' />")[0]

  div = $("<div />").html(el.text()).css({ 
    zIndex : 50, 
    position : 'absolute', 
    left : 0, 
    top : 0, 
    background : 'white', 
    width : SIZE, 
    height : SIZE, 
    padding : '10px', 
    border : '1px solid #ccc',
    fontSize : '22px'
  })

  div.find("img").each (index, img) =>
    img.src = URI.resolve(connector.uri, img.getAttribute("src"))

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
  obj.body = boxBody

  obj

module.exports = Billboard