var CANNON = require('cannon')
var THREE = require('three')
var ndarray = require("ndarray")
var fill = require("ndarray-fill")
var ops = require("ndarray-ops")
var createAOMesh = require("ao-mesher")
var crunch = require("voxel-crunch")


function Voxel () {
}

Voxel.create = function (connector, el) {
  //Voxel resolution
  var resolution = [32,32,32]

  var src = el.attr('src').replace(/^data:/, '')
  var voxels = new Uint8Array(atob(src).split("").map(function(c) { return c.charCodeAt(0) }))
  var result = crunch.decode(voxels, new Int32Array(resolution[0] * resolution[1] * resolution[2]))
  voxels = ndarray(result, resolution)

  // Create mesh
  var vertData = createAOMesh(voxels)

  // Create geometry
  var geometry = new THREE.Geometry()
  var face = 0
  var i = 0
  var collisionVertices = []
  var collisionIndices = []

  while (i < vertData.length) {
    var v = new THREE.Vector3(-16, -16, -16)

    geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v))
    collisionVertices.push(vertData[i + 0] + v.x, vertData[i + 1] + v.y, vertData[i + 2] + v.z)
    i += 8

    geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v))
    collisionVertices.push(vertData[i + 0] + v.x, vertData[i + 1] + v.y, vertData[i + 2] + v.z)
    i += 8

    geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v))
    collisionVertices.push(vertData[i + 0] + v.x, vertData[i + 1] + v.y, vertData[i + 2] + v.z)
    i += 8

    geometry.faces.push( new THREE.Face3( face + 0, face + 1, face + 2 ) )
    collisionIndices.push(face + 0, face + 1, face + 2)
    face += 3
  }

  geometry.computeBoundingSphere();
  geometry.computeFaceNormals()
  geometry.computeVertexNormals()

  var mat = new THREE.MeshLambertMaterial({ wireframe: false, color: '#ffffff' })
  var obj = new THREE.Mesh(geometry, mat)

  var trimeshShape = new CANNON.Trimesh(collisionVertices, collisionIndices)
  var trimeshBody = new CANNON.Body({ mass: 0 })
  trimeshBody.addShape(trimeshShape)
  obj.body = trimeshBody;

  return obj
}

module.exports = Voxel;
