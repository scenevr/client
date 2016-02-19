var Utils = require('../utils');
var THREE = require('three');

function Portal (client, renderer, portal, portalScene) {
  this.client = client;
  this.renderer = renderer;
  this.portal = portal;
  this.portalScene = portalScene;
  this.controls = client.controls;

  this.initialize();
}

Portal.prototype.initialize = function () {
  this.stencilScene = new THREE.Scene();
  this.raycaster = new THREE.Raycaster();

  var geometry = new THREE.CircleGeometry(1 * 0.75, 40);
  var position = this.getElement().attr('position') && Utils.parseVector(this.getElement().attr('position'));
  var material = new THREE.MeshLambertMaterial({ color: '#eeeeee' });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.z += 0.01;
  mesh.quaternion.copy(this.portal.obj.quaternion);
  mesh.visible = true;
  mesh.updateMatrix();
  mesh.updateMatrixWorld(true);
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;

  this.stencilScene.add(mesh);
};

Portal.prototype.getElement = function () {
  return this.portal.el;
};

Portal.prototype.checkForPortalCollision = function () {
  var position = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());
  this.raycaster.set(position, direction);
  this.raycaster.far = 0.5;

  var ints = this.raycaster.intersectObject(this.stencilScene.children[0], false);

  if ((ints.length > 0) && (this.portal.connector.hasSpawned())) {
    return this.client.promotePortal();
  }
};

Portal.prototype.render = function (scene, camera) {
  this.checkForPortalCollision();

  var originalCameraMatrixWorld = new THREE.Matrix4();
  var originalCameraProjectionMatrix = new THREE.Matrix4();
  var originalCameraPosition = camera.position.clone();

  var gl = this.renderer.context;

  originalCameraMatrixWorld.copy(camera.matrixWorld);
  originalCameraProjectionMatrix.copy(camera.projectionMatrix);
  this.renderer.clear(true, true, true);

  gl.colorMask(false, false, false, false);
  gl.depthMask(false);
  gl.enable(gl.STENCIL_TEST);
  gl.stencilMask(0xFF);
  gl.stencilFunc(gl.NEVER, 0, 0xFF);
  gl.stencilOp(gl.INCR, gl.KEEP, gl.KEEP);
  this.renderer.render(this.stencilScene, camera);

  gl.colorMask(true, true, true, true);
  gl.depthMask(true);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

  this.renderer.clear(false, true, false);
  gl.stencilFunc(gl.LESS, 0, 0xff);

  // TODO: fix this.client.connector....
  // Offset camera to be at spawn
  var v = this.controls.getPosition().clone().sub(this.portal.obj.position.clone());
  v.add(this.portal.connector.spawnPosition);
  v.y += 1.0;

  camera.matrixWorld.setPosition(v);

  this.renderer.render(this.portalScene, camera);
  gl.disable(gl.STENCIL_TEST);
  camera.position.copy(originalCameraPosition);

  this.renderer.clear(false, false, true);
  camera.matrixWorld.copy(originalCameraMatrixWorld);
  camera.projectionMatrix.copy(originalCameraProjectionMatrix);
  this.renderer.clear(false, true, false);

  gl.colorMask(false, false, false, false);
  gl.depthMask(true);

  this.renderer.render(this.stencilScene, camera);

  gl.colorMask(true, true, true, true);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
  this.renderer.render(scene, camera);
  camera.projectionMatrix.copy(originalCameraProjectionMatrix);
};

module.exports = Portal;
