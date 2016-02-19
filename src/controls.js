var EventEmitter = require('events').EventEmitter;
var THREE = require('three');
var CANNON = require('cannon');
var environment = require('./environment');
var Utilities = require('../vendor/webvr-manager/util');
var Gamepad = require('./lib/gamepad');

/**
 * @author mrdoob / http://mrdoob.com/
 * @author schteppe / https://github.com/schteppe
 */

class PointerLockControls extends EventEmitter {
  constructor (camera, client, mobile, supportsPointerLock) {
    super();

    var scope = this;

    var walkSpeed = environment.getWalkSpeed();
    var runSpeed = environment.getRunSpeed();
    var jumpVelocity = environment.getJumpImpulse();
    var dampingFactor = 0.7;
    var cannonBody = null;
    var velocity = new THREE.Vector3();
    var pitchObject = new THREE.Object3D();
    pitchObject.add(camera);
    var yawObject = new THREE.Object3D();
    yawObject.position.y = 2;
    yawObject.add(pitchObject);
    var quat = new THREE.Quaternion();
    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;
    var isRunning = false;
    var canJump = false;
    var contactNormal = new CANNON.Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    var upAxis = new CANNON.Vec3(0, 1, 0);

    this.jump = function () {
      if (canJump === true) {
        velocity.y = jumpVelocity;
      }

      canJump = false;
    };

    this.gamepad = new Gamepad(this);
    this.enabled = false;

    this.getPitchObject = () => {
      return pitchObject;
    };

    this.getYawObject = () => {
      return yawObject;
    };

    var interval = setInterval(() => {
      if (this.gamepad.present()) {
        this.emit('gamepad-detected');
        clearInterval(interval);
      }
    }, 250);

    if (Utilities.isMobile()) {
      this.vrcontrols = new THREE.VRControls(yawObject);
      yawObject.useQuaternion = true;
    }

    this.setCannonBody = function (x) {
      cannonBody = x;

      velocity = cannonBody.velocity;

      cannonBody.addEventListener('collide', function (e) {
        var contact = e.contact;

        // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
        // We do not yet know which one is which! Let's check.
        if (contact.bi.id === cannonBody.id) {  // bi is the player body, flip the contact normal
          contact.ni.negate(contactNormal);
        } else {
          contactNormal.copy(contact.ni); // bi is something else. Keep the normal as it is
        }

        // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
        if (contactNormal.dot(upAxis) >= 0) { // Use a "good" threshold value between 0 and 1 here!
          canJump = true;
        }
      });
    };

    var PI_2 = Math.PI / 2;

    document.addEventListener('click', function (event) {
      if (scope.enabled === false) {
        return;
      }

      client.onClick(event);
    }, false);

    document.addEventListener('touchstart', function (event) {
      if (Utilities.isMobile()) {
        moveForward = true;
      }
    });

    document.addEventListener('touchend', function (event) {
      if (Utilities.isMobile()) {
        moveForward = false;
      }
    });

    document.addEventListener('mousedown', function (event) {
      if (scope.enabled === false) {
        return;
      }

      event.preventDefault();
      // client.trigger('mousedown', [event]);
    }, false);

    document.addEventListener('mouseup', function (event) {
      if (scope.enabled === false) {
        return;
      }

      event.preventDefault();
      // client.trigger('mouseup', [event]);
    }, false);

    document.addEventListener('mousemove', function (event) {
      if (scope.enabled === false) {
        return;
      }

      var movementX = event.movementX || event.mozMovementX || 0;
      var movementY = event.movementY || event.mozMovementY || 0;

      yawObject.rotation.y -= movementX * 0.002;
      pitchObject.rotation.x -= movementY * 0.002;
      pitchObject.rotation.x = Math.max(-PI_2, Math.min(PI_2, pitchObject.rotation.x));
    }, false);

    document.addEventListener('keydown', function (event) {
      isRunning = event.shiftKey;

      if (scope.enabled === false) return;

      switch (event.keyCode) {
        case 38: // up
        case 87: // w
          moveForward = true;
          break;
        case 37: // left
        case 65: // a
          moveLeft = true;
          break;
        case 40: // down
        case 83: // s
          moveBackward = true;
          break;
        case 39: // right
        case 68: // d
          moveRight = true;
          break;
        case 32: // space
          if (canJump === true) {
            velocity.y = jumpVelocity;
          }
          canJump = false;
          break;
      }
    }, false);

    document.addEventListener('keyup', function (event) {
      isRunning = event.shiftKey;

      if (scope.enabled === false) {
        return;
      }

      switch (event.keyCode) {
        case 38: // up
        case 87: // w
            moveForward = false;
            break;
        case 37: // left
        case 65: // a
            moveLeft = false;
            break;
        case 40: // down
        case 83: // a
            moveBackward = false;
            break;
        case 39: // right
        case 68: // d
          moveRight = false;
          break;
      }
    }, false);

    document.addEventListener('touchstart', function (e) {
      e.preventDefault();
    }, false);

    var movementX = 0;
    var movementY = 0;
    var direction = new THREE.Vector2(0, 0);

    document.addEventListener('touchstart', function (e) {
      var i;

      for (i = 0; i < e.touches.length; i++) {
        var touch = e.touches[i];

        if (touch.clientY < window.innerHeight * 0.75) {
          client.trigger('click');
        }
      }
    });

    document.addEventListener('touchend', function (e) {
      movementX = 0;
      movementY = 0;
      direction.set(0, 0);
    });

    document.addEventListener('touchmove', function (e) {
      if (scope.enabled === false) {
        return;
      }

      var i;

      for (i = 0; i < e.touches.length; i++) {
        var touch = e.touches[i];

        if (touch.clientY < window.innerHeight * 0.75) {
          continue;
        }

        if (touch.clientX > window.innerWidth / 2) {
          movementX = touch.clientX - (window.innerWidth - 60);
          movementY = touch.clientY - (window.innerHeight - 60);

          movementX *= 0.4;
          movementY *= 0.4;
        }

        if (touch.clientX < window.innerWidth / 2) {
          direction.set(
              touch.clientX - (60),
              touch.clientY - (window.innerHeight - 60)
          );

          direction.multiplyScalar(0.1);

          if (direction.x < -1) {
            direction.x = -1;
          }
          if (direction.y < -1) {
            direction.y = -1;
          }
          if (direction.x > 1) {
            direction.x = 1;
          }
          if (direction.y > 1) {
            direction.y = 1;
          }

          // direction.clampscalar(-1, 1);
        }
      }

      e.preventDefault();
    });

    document.addEventListener('contextmenu', function (e) {
      if (scope.enabled === false) return;
      e.preventDefault();
      return false;
    });

    document.addEventListener('dblclick', function (e) {
      if (scope.enabled === false) return;
      e.preventDefault();
      return false;
    });

    this.getObject = function () {
      return yawObject;
    };

    this.getYaw = function () {
      return yawObject.rotation.y;
    };

    this.getPitch = function () {
      return pitchObject.rotation.x;
    };

    this.setYaw = function (d) {
      yawObject.rotation.y = d;
    };

    this.getPosition = function () {
      return yawObject.position;
    };

    this.getVelocity = function () {
      return velocity;
    };

    this.getRotation = function () {
      var e = new THREE.Euler();
      e.y = this.getYaw();
      e.x = this.getPitch();
      return e;
    };

    // fix me add pitch
    this.getQuaternion = function () {
      var q = new THREE.Quaternion();
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.getYaw());
      return q;
    };

    this.getDirection = function (targetVec) {
      var m1 = new THREE.Matrix4();
      var m2 = new THREE.Matrix4();

      m1.makeRotationX(pitchObject.rotation.x);
      m2.makeRotationY(yawObject.rotation.y);

      m2.multiply(m1);
      targetVec.set(0, 0, -1);
      targetVec.applyMatrix4(m2);

      return targetVec.normalize();
    };

    // Moves the camera to the Cannon.js object position and adds velocity to the object if the run key is down
    var inputVelocity = new THREE.Vector3();
    var euler = new THREE.Euler();

    this.update = function (delta) {
      yawObject.rotation.y -= movementX * 0.002;
      pitchObject.rotation.x -= movementY * 0.002;
      pitchObject.rotation.x = Math.max(-PI_2, Math.min(PI_2, pitchObject.rotation.x));

      if (!supportsPointerLock) {
        if (moveLeft) {
          yawObject.rotation.y += 0.02;
        }
        if (moveRight) {
          yawObject.rotation.y -= 0.02;
        }
      }

      inputVelocity.set(0, 0, 0);

      var velocityFactor;

      if (mobile) {
        velocityFactor = walkSpeed / 60;
        // inputVelocity.z = direction.y * velocityFactor * delta;
        // inputVelocity.x = direction.x * velocityFactor * delta;
      } else {
        velocityFactor = (isRunning ? runSpeed : walkSpeed) / 50;
      }

      if (this.gamepad.present()) {
        inputVelocity.copy(this.gamepad.getInputVelocity(velocityFactor * delta));

        var d = this.gamepad.getLookDirection(
          new THREE.Euler(pitchObject.rotation.x, yawObject.rotation.y, 0)
        );

        pitchObject.rotation.x = d.x;
        yawObject.rotation.y = d.y;
      } else {
        if (moveForward) {
          inputVelocity.z = -velocityFactor * delta;
        }
        if (moveBackward) {
          inputVelocity.z = velocityFactor * delta;
        }

        if (supportsPointerLock) {
          if (moveLeft) {
            inputVelocity.x = -velocityFactor * delta;
          }
          if (moveRight) {
            inputVelocity.x = velocityFactor * delta;
          }
        }
      }

      // Convert velocity to world coordinates
      euler.x = pitchObject.rotation.x;
      euler.y = yawObject.rotation.y;
      euler.order = 'XYZ';
      quat.setFromEuler(euler);

      if (this.vrcontrols) {
        inputVelocity.applyQuaternion(yawObject.quaternion);
      } else {
        inputVelocity.applyQuaternion(quat);
      }

      // Add to the object
      velocity.x = velocity.x * dampingFactor + inputVelocity.x;
      velocity.z = velocity.z * dampingFactor + inputVelocity.z;

      yawObject.position.copy(cannonBody.position).add(new THREE.Vector3(0, 0.9, 0));

      if (this.vrcontrols) {
        this.vrcontrols.update();
      }
    };
  };
}

module.exports = PointerLockControls;
