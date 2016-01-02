var THREE = require('three.js');
var Y_AXIS = new THREE.Vector3(0, 1, 0);

function StereoscopicEffect (client, renderer, controls, hmd, hmdSensor) {
  this.client = client;
  this.renderer = renderer;
  this.controls = controls;
  this.hmd = hmd;
  this.hmdSensor = hmdSensor;
  this.yawOffset = 0.0;

  this.initialize();
}

StereoscopicEffect.prototype.initialize = function () {
  var et = this.hmd.getEyeTranslation('left');
  this.halfIPD = new THREE.Vector3(et.x, et.y, et.z).length();
  this.fovLeft = this.hmd.getRecommendedEyeFieldOfView('left');
  this.fovRight = this.hmd.getRecommendedEyeFieldOfView('right');
};

StereoscopicEffect.prototype.FovToNDCScaleOffset = function (fov) {
  var pxscale = 2.0 / (fov.leftTan + fov.rightTan);
  var pxoffset = (fov.leftTan - fov.rightTan) * pxscale * 0.5;
  var pyscale = 2.0 / (fov.upTan + fov.downTan);
  var pyoffset = (fov.upTan - fov.downTan) * pyscale * 0.5;

  return {
    scale: [pxscale, pyscale],
    offset: [pxoffset, pyoffset]
  };
};

StereoscopicEffect.prototype.FovPortToProjection = function (fov, rightHanded, zNear, zFar) {
  rightHanded = rightHanded === undefined ? true : rightHanded;
  zNear = zNear === undefined ? 0.01 : zNear;
  zFar = zFar === undefined ? 10000.0 : zFar;

  var handednessScale = rightHanded ? -1.0 : 1.0;
  var mobj = new THREE.Matrix4();
  var m = mobj.elements;
  var scaleAndOffset = this.FovToNDCScaleOffset(fov);

  m[0 * 4 + 0] = scaleAndOffset.scale[0];
  m[0 * 4 + 1] = 0.0;
  m[0 * 4 + 2] = scaleAndOffset.offset[0] * handednessScale;
  m[0 * 4 + 3] = 0.0;
  m[1 * 4 + 0] = 0.0;
  m[1 * 4 + 1] = scaleAndOffset.scale[1];
  m[1 * 4 + 2] = -scaleAndOffset.offset[1] * handednessScale;
  m[1 * 4 + 3] = 0.0;
  m[2 * 4 + 0] = 0.0;
  m[2 * 4 + 1] = 0.0;
  m[2 * 4 + 2] = zFar / (zNear - zFar) * -handednessScale;
  m[2 * 4 + 3] = (zFar * zNear) / (zNear - zFar);
  m[3 * 4 + 0] = 0.0;
  m[3 * 4 + 1] = 0.0;
  m[3 * 4 + 2] = handednessScale;
  m[3 * 4 + 3] = 0.0;

  mobj.transpose();

  return mobj;
};

StereoscopicEffect.prototype.FovToProjection = function (fov, rightHanded, zNear, zFar) {
  var fovPort = {
    upTan: Math.tan(fov.upDegrees * Math.PI / 180.0),
    downTan: Math.tan(fov.downDegrees * Math.PI / 180.0),
    leftTan: Math.tan(fov.leftDegrees * Math.PI / 180.0),
    rightTan: Math.tan(fov.rightDegrees * Math.PI / 180.0)
  };

  return this.FovPortToProjection(fovPort, rightHanded, zNear, zFar);
};

StereoscopicEffect.prototype.resetOrientation = function () {
  var euler = new THREE.Euler().setFromQuaternion(this.hmdSensor.getState().orientation);
  this.yawOffset = -euler.y;
};

StereoscopicEffect.prototype.getOrientation = function () {
  return this.hmdSensor.getState().orientation;
};

var memoQuaternion = new THREE.Quaternion();

StereoscopicEffect.prototype.render = function (scene, camera) {
  var cameraLeft = camera.clone();
  var cameraRight = camera.clone();

  cameraLeft.position.copy(camera.parent.parent.position);
  cameraRight.position.copy(camera.parent.parent.position);

  memoQuaternion.setFromAxisAngle(Y_AXIS, this.controls.getYaw() + this.yawOffset);

  cameraLeft.quaternion.multiplyQuaternions(memoQuaternion, cameraLeft.quaternion);
  cameraRight.quaternion.multiplyQuaternions(memoQuaternion, cameraRight.quaternion);

  cameraLeft.projectionMatrix = this.FovToProjection(this.fovLeft, true, camera.near, camera.far);
  cameraRight.projectionMatrix = this.FovToProjection(this.fovRight, true, camera.near, camera.far);

  var right = new THREE.Vector3(1, 0, 0);
  right.applyQuaternion(camera.quaternion);

  cameraLeft.position.sub(right.clone().multiplyScalar(this.halfIPD));
  cameraRight.position.add(right.clone().multiplyScalar(this.halfIPD));
  this.renderer.enableScissorTest(true);

  var width = this.renderer.domElement.width / 2;
  var height = this.renderer.domElement.height;

  this.renderer.setViewport(0, 0, width, height);
  this.renderer.setScissor(0, 0, width, height);
  this.renderer.render(scene, cameraLeft);
  this.renderer.setViewport(width, 0, width, height);
  this.renderer.setScissor(width, 0, width, height);
  this.renderer.render(scene, cameraRight);
};

module.exports = StereoscopicEffect;
