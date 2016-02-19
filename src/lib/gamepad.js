var PI_2 = Math.PI / 2;
var THREE = require('three');

var inputVelocity = new THREE.Vector3();

class Gamepad {
  constructor (controls) {
    this.controls = controls;
  }

  pollGamepad () {
    this.gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
    this.gamepad = this.gamepads[0];
    return this.gamepad;
  }

  present () {
    return this.pollGamepad();
  }

  getName () {
    return this.gamepad.id;
  }

  getLookDirection (euler) {
    var speed = 0.02;

    if (this.gamepad.axes[2] < -0.3) {
      euler.y += speed;
    }
    if (this.gamepad.axes[2] > 0.3) {
      euler.y -= speed;
    }
    if (this.gamepad.axes[3] < -0.3) {
      euler.x += speed;
    }
    if (this.gamepad.axes[3] > 0.3) {
      euler.x -= speed;
    }

    return euler;
  }

  getInputVelocity (length) {
    this.pollGamepad();

    inputVelocity.set(0, 0, 0);

    if (this.gamepad.axes[0] < -0.3) {
      inputVelocity.x = -length;
    }
    if (this.gamepad.axes[0] > 0.3) {
      inputVelocity.x = length;
    }
    if (this.gamepad.axes[1] < -0.3) {
      inputVelocity.z = -length;
    }
    if (this.gamepad.axes[1] > 0.3) {
      inputVelocity.z = length;
    }

    if (this.gamepad.buttons[1].pressed) {
      this.controls.jump();
    }

    return inputVelocity;
  }
}

module.exports = Gamepad;
