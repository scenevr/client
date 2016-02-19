/* globals fetch, atob, FileReader */

var CANNON = require('cannon');
var THREE = require('three');
var ndarray = require('ndarray');
var createAOMesh = require('ao-mesher');
var crunch = require('voxel-crunch');
// var environment = require('../environment');
// var palette = require('../data/palette');
var palette = require('../data/magica-colors');
var grid = require('../data/grid.js');
var voxToNdarray = require('vox-to-ndarray');
var zeros = require('zeros');

var SIZE = 32;

class Voxel {
  constructor (connector, el) {
    this.connector = connector;
    this.el = el;
    this.obj = new THREE.Object3D();

    var floorTexture = THREE.ImageUtils.loadTexture(grid);
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;

    this.obj.material = new THREE.MeshLambertMaterial({
      wireframe: false,
      map: floorTexture,
      vertexColors: THREE.VertexColors
    });
  }

  load () {
    // Voxel resolution
    this.resolution = [SIZE, SIZE, SIZE];

    if (this.el.hasAttribute('resolution')) {
      this.resolution = this.el.getAttribute('resolution').split(' ').map(function (x) {
        return parseInt(x, 10);
      });
    }

    var src = this.el.getAttribute('src');

    if (src.match(/^data:/)) {
      src = this.el.attr('src').replace(/^data:/, '');
      var voxels = new Uint8Array(atob(src).split('').map(function (c) { return c.charCodeAt(0); }));
      var result = crunch.decode(voxels, new Int32Array(this.resolution[0] * this.resolution[1] * this.resolution[2]));
      this.voxels = ndarray(result, this.resolution);
      this.generateMeshFromVoxels();
    } else if (src.match(/\.vox$/i)) {
      fetch(this.connector.resolveUrl(src)).then((response) => {
        return response.blob();
      }).then((blob) => {
        var reader = new FileReader();

        reader.addEventListener('loadend', () => {
          this.voxels = voxToNdarray(reader.result);
          this.resolution = this.voxels.shape;
          this.generateMeshFromVoxels();
        });

        reader.readAsArrayBuffer(blob);
      });
    } else {
      console.log('Unknown vox style');
    }
  }

  generateMeshFromVoxels () {
    // var padding = this.resolution.map((r) => r + 2);

    // var voxelsWithPadding = zeros(padding, 'int32');

    var x, y, z;

    for (x = 0; x < this.resolution[0]; x++) {
      for (y = 0; y < this.resolution[1]; y++) {
        for (z = 0; z < this.resolution[2]; z++) {
        // fixme - copy a row at a time for speeed
          var v = this.voxels.get(x, y, z);

          v = v ? (1 << 15) + 1 : 0;

          this.voxels.set(x, y, z, v);
        }
      }
    }

    // Create mesh
    var vertData = createAOMesh(this.voxels);

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
      var v = new THREE.Vector3(-this.resolution[0] / 2, 0, -this.resolution[0] / 2).round();
      var s = 1.0
      var texture = vertData[i + 7];

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

      var f = new THREE.Face3( face + 0, face + 1, face + 2 )
      // f.vertexColors = [new THREE.Color(vertData[i - 8 + 3]), new THREE.Color('#00ff00'), new THREE.Color('#0000ff')]

      f.vertexColors = [
        // new THREE.Color(palette[texture]),
        // new THREE.Color(palette[texture]),
        // new THREE.Color(palette[texture])
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
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    var childObj = new THREE.Mesh(geometry, this.obj.material);
    this.obj.add(childObj);

    var trimeshShape = new CANNON.Trimesh(collisionVertices, collisionIndices);
    var trimeshBody = new CANNON.Body({ mass: 0 });
    trimeshBody.addShape(trimeshShape);
    trimeshBody.position.copy(this.obj.position);
    trimeshBody.quaternion.copy(this.obj.quaternion);
    trimeshBody.uuid = this.el.getAttribute('uuid');
    this.obj.body = trimeshBody;

    // Be nice to decouple this somehow
    this.connector.physicsWorld.add(this.obj.body);

    childObj.castShadow = true;
    childObj.receiveShadow = true;

    console.log('!');
  }
}

Voxel.create = function (connector, el) {
  var v = new Voxel(connector, el[0]);
  v.load();
  return v.obj;
};

module.exports = Voxel;
