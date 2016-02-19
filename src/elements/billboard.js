var THREE = require('three');
var $ = require('jquery');
var Utils = require('../utils');
var URI = require('uri-js');
var CANNON = require('cannon');
var html2canvas = require('html2canvas');
var environment = require('../environment');
var spinner = require('../data/spinner.js');

// fixme - this sucks.
if (!window.html2canvas) {
  window.html2canvas = html2canvas;
}

var SIZE = 512;

function Billboard () {
}

Billboard.getLoadingMaterial = function () {
  if (!this._loadingMaterial) {
    var texture = THREE.ImageUtils.loadTexture(spinner);

    this._loadingMaterial = new THREE.MeshBasicMaterial({
      fog: true,
      map: texture,
      side: THREE.DoubleSide
    });
  }

  return this._loadingMaterial;
};

Billboard.create = function (connector, el) {
  var obj = new THREE.Object3D();

  var div = $('<div />').html(el.text()).css({
    zIndex: 50,
    position: 'absolute',
    left: 4000,
    top: 0,
    background: 'white',
    width: SIZE,
    height: SIZE,
    padding: '10px',
    border: '1px solid #ccc',
    fontSize: '22px'
  });

  div.find('img').each(function (index, img) {
    img.src = URI.resolve(URI.serialize(connector.assetUri), img.getAttribute('src'));
  });

  var geometry = new THREE.BoxGeometry(1, 1, 1);
  var material = new THREE.MeshLambertMaterial({
    color: '#eeeeee',
    ambient: '#eeeeee'
  });

  var nullMaterial = new THREE.MeshBasicMaterial({ visible: false });
  var box = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial([material, nullMaterial]));
  box.castShadow = true;
  box.recieveShadow = true;

  geometry.faces.forEach(function (face) {
    face.materialIndex = 0;
  });
  geometry.faces[8].materialIndex = 1;
  geometry.faces[9].materialIndex = 1;

  material = new THREE.MeshLambertMaterial({
    color: '#ffffff'
  });

  var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), material);
  mesh.position.setZ(0.5);
  mesh.material = this.getLoadingMaterial();
  mesh.castShadow = true;
  mesh.recieveShadow = true;

  obj.add(box);
  obj.add(mesh);

  var newScale = el.attr('scale') ? Utils.parseVector(el.attr('scale')) : new THREE.Vector3(2, 2, 0.5);
  obj.scale.copy(newScale);

  var boxShape = new CANNON.Box(new CANNON.Vec3().copy(newScale.multiplyScalar(0.5)));
  var boxBody = new CANNON.Body({
    mass: 0
  });
  boxBody.addShape(boxShape);

  obj.body = boxBody;

  connector.renderQueue.add(function (finished) {
    div.appendTo('body');

    html2canvas(div[0], {
      useCORS: true,
      taintTest: false,
      letterRendering: false,
      removeContainer: false,
      javascriptEnabled: false
    }).then(function (canvas) {
      var texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;

      material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      });

      material.transparent = false;
      mesh.material = material;

      div.remove();

      finished();
    }).catch(function (err) {
      console.log('Error creating billboard: ' + err);
    });
  });

  return obj;
};

module.exports = Billboard;
