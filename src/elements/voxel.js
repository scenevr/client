var CANNON = require('cannon')
var THREE = require('three.js')
var ndarray = require('ndarray')
var createAOMesh = require('ao-mesher')
var crunch = require('voxel-crunch')
var environment = require('../environment')
var palette = require('../data/palette')
var grid = require('../data/grid.js')

var SIZE = 32

function Voxel () {
}

Voxel.create = function (connector, el) {
  //Voxel resolution

  var resolution = [SIZE, SIZE, SIZE]

  if (el.attr('resolution')) {
    resolution = el.attr('resolution').split(' ').map(function (x) {
      return parseInt(x, 10)
    })
  }

  console.log(el.attr('resolution'))
  console.log(resolution)

  var src = el.attr('src').replace(/^data:/, '')
  var voxels = new Uint8Array(atob(src).split("").map(function(c) { return c.charCodeAt(0) }))
  var result = crunch.decode(voxels, new Int32Array(resolution[0] * resolution[1] * resolution[2]))
  voxels = ndarray(result, resolution)

  // Create mesh
  var vertData = createAOMesh(voxels)

  // Create geometry
  var geometry = new THREE.Geometry()
  var face = 0
  var collisionVertices = []
  var collisionIndices = []
  var vertices = new Float32Array(vertData.length / 8)

  var uvs = geometry.faceVertexUvs[0] = []

  var i = 0
  var j = 0
  while (i < vertData.length) {
    var v = new THREE.Vector3(-16, -16, -16)
    var s = 1.0
    var texture = vertData[i + 7]

    var uvSet = []
    var uv

    uv = new THREE.Vector2()
    uv.x = vertices[j++] = vertData[i + 0] + v.x
    uv.y = vertices[j++] = vertData[i + 1] + v.y
    uv.x += vertices[j++] = vertData[i + 2] + v.z
    geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v).multiplyScalar(s))
    collisionVertices.push((vertData[i + 0] + v.x) * s, (vertData[i + 1] + v.y) * s, (vertData[i + 2] + v.z) * s)
    uvSet.push(uv)
    i += 8

    uv = new THREE.Vector2()
    uv.x = vertices[j++] = vertData[i + 0] + v.x
    uv.y = vertices[j++] = vertData[i + 1] + v.y
    uv.x += vertices[j++] = vertData[i + 2] + v.z
    geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v).multiplyScalar(s))
    collisionVertices.push((vertData[i + 0] + v.x) * s, (vertData[i + 1] + v.y) * s, (vertData[i + 2] + v.z) * s)
    uvSet.push(uv)
    i += 8

    uv = new THREE.Vector2()
    uv.x = vertices[j++] = vertData[i + 0] + v.x
    uv.y = vertices[j++] = vertData[i + 1] + v.y
    uv.x += vertices[j++] = vertData[i + 2] + v.z
    geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v).multiplyScalar(s))
    collisionVertices.push((vertData[i + 0] + v.x) * s, (vertData[i + 1] + v.y) * s, (vertData[i + 2] + v.z) * s)
    uvSet.push(uv)
    i += 8

    var texture = 15

    var f = new THREE.Face3( face + 0, face + 1, face + 2 )
    // f.vertexColors = [new THREE.Color(vertData[i - 8 + 3]), new THREE.Color('#00ff00'), new THREE.Color('#0000ff')]
    f.vertexColors = [
      //new THREE.Color(palette[texture]),
      //new THREE.Color(palette[texture]),
      //new THREE.Color(palette[texture])
      new THREE.Color().setHSL(0, 0, vertData[i - 24 + 3] / 255.0),
      new THREE.Color().setHSL(0, 0, vertData[i - 16 + 3] / 255.0),
      new THREE.Color().setHSL(0, 0, vertData[i - 8 + 3] / 255.0)
    ]
    geometry.faces.push(f)
    uvs.push(uvSet) // [new THREE.Vector2(1,1), new THREE.Vector2(0, 1), new THREE.Vector2(0, 0)])
    collisionIndices.push(face + 0, face + 1, face + 2)
    face += 3
  }

  geometry.computeBoundingSphere();
  geometry.computeFaceNormals()
  geometry.computeVertexNormals()

  var floorTexture = THREE.ImageUtils.loadTexture(grid);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;

  var mat = new THREE.MeshLambertMaterial({ wireframe: false, map: floorTexture, vertexColors: THREE.VertexColors })

  // var mat = new THREE.ShaderMaterial({
  //   fragmentShader: glslify('../effects/voxel-ao-fragment.glsl'),
  //   uniforms: {
  //     // iChannel0: { type: 't', value: tex },
  //     // iGlobalTime: { type: 'f', value: 0 }
  //   },
  //   defines: {
  //     USE_MAP: ''
  //   }
  // })

  var obj = new THREE.Mesh(geometry, mat)

  var trimeshShape = new CANNON.Trimesh(collisionVertices, collisionIndices)
  var trimeshBody = new CANNON.Body({ mass: 0 })
  trimeshBody.addShape(trimeshShape)
  obj.body = trimeshBody;
  obj.castShadow = true;
  obj.receiveShadow = true;

  return obj
}

module.exports = Voxel;
