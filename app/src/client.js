(function() {
  var Client, Connector, DOWN_SAMPLE, EventEmitter, MOBILE, PHYSICS_HZ, TWEEN, Templates, URI,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Connector = require("./connector");

  URI = require("uri-js");

  Templates = {
    inQueue: require("../templates/in_queue.jade"),
    unableToConnect: require("../templates/unable_to_connect.jade"),
    instructions: require("../templates/instructions.jade"),
    connecting: require("../templates/connecting.jade")
  };

  window.CANNON = require("cannon");

  TWEEN = require("tween.js");

  EventEmitter = require('wolfy87-eventemitter');

  DOWN_SAMPLE = 1;

  PHYSICS_HZ = 60.0;

  MOBILE = false;

  DOWN_SAMPLE = 1;

  if (/Android|iPhone|iPad|iPod|IEMobile/i.test(navigator.userAgent)) {
    MOBILE = true;
  }

  Client = (function(_super) {
    __extends(Client, _super);

    function Client() {
      this.tick = __bind(this.tick, this);
      this.tickPhysics = __bind(this.tickPhysics, this);
      this.onClick = __bind(this.onClick, this);
      this.vrDeviceCallback = __bind(this.vrDeviceCallback, this);
      this.pointerlockchange = __bind(this.pointerlockchange, this);
      this.pointerlockerror = __bind(this.pointerlockerror, this);
      this.onWindowResize = __bind(this.onWindowResize, this);
      var ASPECT, FAR, NEAR, VIEW_ANGLE;
      this.container = $("#scene-view").css({
        position: 'relative'
      });
      this.width = this.container.width();
      this.height = this.container.height();
      this.stats = new Stats();
      this.stats.setMode(0);
      this.stats.domElement.style.position = 'absolute';
      this.stats.domElement.style.top = '10px';
      this.stats.domElement.style.zIndex = 110;
      this.stats.domElement.style.left = '10px';
      this.container.append(this.stats.domElement);
      VIEW_ANGLE = 60;
      ASPECT = this.width / this.height;
      NEAR = 0.1;
      FAR = 700;
      this.scene = new THREE.Scene();
      this.world = new CANNON.World();
      this.world.gravity.set(0, -20, 0);
      this.world.broadphase = new CANNON.NaiveBroadphase();
      this.renderer = new THREE.WebGLRenderer({
        antialias: false
      });
      this.renderer.setSize(this.width / DOWN_SAMPLE, this.height / DOWN_SAMPLE);
      this.renderer.setClearColor(0x000000);
      this.renderer.autoClear = false;
      this.initVR();
      this.time = Date.now();
      if (!MOBILE) {
        this.addMessageInput();
        this.addPointLockGrab();
      }
      this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
      this.addControls();
      this.addPlayerBody();
      this.addDot();
      this.connector = new Connector(this, this.scene, this.world, this.getUriFromLocation());
      this.connector.connect();
      this.addConnecting();
      this.connector.on('connected', (function(_this) {
        return function() {
          if (MOBILE) {
            return _this.enableControls();
          } else {
            return _this.addInstructions();
          }
        };
      })(this));
      this.connector.on('disconnected', (function(_this) {
        return function() {
          return _this.addConnectionError();
        };
      })(this));
      this.connector.on('restarting', (function(_this) {
        return function() {
          return _this.showMessage("Reconnecting...");
        };
      })(this));
      this.on('click', this.onClick);
      this.raycaster = new THREE.Raycaster;
      this.container.append(this.renderer.domElement);
      $(this.renderer.domElement).css({
        width: this.width,
        height: this.height
      });
      this.tick();
      setInterval(this.tickPhysics, 1000 / PHYSICS_HZ);
      window.addEventListener('resize', this.onWindowResize, false);
      window.addEventListener("keypress", (function(_this) {
        return function(e) {
          if ((e.charCode === 'r'.charCodeAt(0)) && _this.vrrenderer && _this.controls.enabled) {
            _this.vrrenderer.resetOrientation(_this.controls, _this.vrHMDSensor);
          }
          if ((e.charCode === 'f'.charCodeAt(0)) && _this.vrrenderer && _this.controls.enabled) {
            if (_this.renderer.domElement.mozRequestFullScreen) {
              _this.renderer.domElement.mozRequestFullScreen({
                vrDisplay: vrHMD
              });
            }
            if (_this.renderer.domElement.webkitRequestFullscreen) {
              return _this.renderer.domElement.webkitRequestFullscreen({
                vrDisplay: _this.vrHMD
              });
            }
          }
        };
      })(this));
    }

    Client.prototype.onWindowResize = function() {
      this.width = this.container.width();
      this.height = this.container.height();
      $(this.renderer.domElement).css({
        width: this.width,
        height: this.height
      });
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width / DOWN_SAMPLE, this.height / DOWN_SAMPLE);
      return this.centerOverlay();
    };

    Client.prototype.hasPointerLock = function() {
      return document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
    };

    Client.prototype.pointerlockerror = function(event) {
      return alert("[FAIL] There was an error acquiring pointerLock. You will not be able to use sceneserver.");
    };

    Client.prototype.pointerlockchange = function(event) {
      if (this.hasPointerLock()) {
        return this.enableControls();
      } else {
        return this.disableControls();
      }
    };

    Client.prototype.enableControls = function() {
      this.controls.enabled = true;
      return this.hideInstructions();
    };

    Client.prototype.disableControls = function() {
      this.controls.enabled = false;
      return this.showInstructions();
    };

    Client.prototype.getUriFromLocation = function() {
      if (window.location.search.match(/connect.+/)) {
        return "//" + window.location.search.split(/[=]/)[1];
      } else {
        return "//scenevr-demo.herokuapp.com/index.xml";
      }
    };

    Client.prototype.removeReflectedObjects = function() {
      var list, obj, _i, _len, _results;
      list = (function() {
        var _i, _len, _ref, _results;
        _ref = this.scene.children;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          obj = _ref[_i];
          if (obj.name) {
            _results.push(obj);
          }
        }
        return _results;
      }).call(this);
      _results = [];
      for (_i = 0, _len = list.length; _i < _len; _i++) {
        obj = list[_i];
        this.scene.remove(obj);
        if (obj.body) {
          _results.push(this.world.remove(obj.body));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Client.prototype.getAllClickableObjects = function() {
      var list;
      list = [];
      this.scene.traverse(function(obj) {
        return list.push(obj);
      });
      return list;
    };

    Client.prototype.initVR = function() {
      if (navigator.getVRDevices) {
        return navigator.getVRDevices().then(this.vrDeviceCallback);
      } else if (navigator.mozGetVRDevices) {
        return navigator.mozGetVRDevices(this.vrDeviceCallback);
      }
    };

    Client.prototype.vrDeviceCallback = function(vrdevs) {
      var device, _i, _j, _len, _len1;
      for (_i = 0, _len = vrdevs.length; _i < _len; _i++) {
        device = vrdevs[_i];
        if (device instanceof HMDVRDevice) {
          this.vrHMD = device;
          break;
        }
      }
      for (_j = 0, _len1 = vrdevs.length; _j < _len1; _j++) {
        device = vrdevs[_j];
        if (device instanceof PositionSensorVRDevice && device.hardwareUnitId === this.vrHMD.hardwareUnitId) {
          this.vrHMDSensor = device;
          break;
        }
      }
      if (this.vrHMD) {
        return this.vrrenderer = new THREE.VRRenderer(this.renderer, this.vrHMD);
      }
    };

    Client.prototype.checkForPortalCollision = function() {
      var direction, ints, position;
      position = this.controls.getObject().position;
      direction = this.controls.getDirection(new THREE.Vector3);
      this.raycaster.set(position, direction);
      this.raycaster.far = 0.5;
      ints = this.raycaster.intersectObject(this.connector.stencilScene.children[0], false);
      if ((ints.length > 0) && (this.connector.portal.connector.hasSpawned())) {
        return this.promotePortal();
      }
    };

    Client.prototype.promotePortal = function() {
      var controlObject;
      this.portal = this.connector.portal;
      window.history.pushState({}, "SceneVR", "?connect=" + this.portal.connector.uri.replace(/^\/\//, ''));
      controlObject = this.controls.getObject();
      this.scene.remove(controlObject);
      this.world.remove(this.playerBody);
      this.world = this.portal.world;
      this.scene = this.portal.scene;
      this.scene.add(controlObject);
      this.connector.disconnect();
      delete this.connector;
      this.connector = this.portal.connector;
      this.connector.isPortal = false;
      delete this.portal;
      delete this.playerBody;
      this.world.gravity.set(0, -20, 0);
      this.world.broadphase = new CANNON.NaiveBroadphase();
      this.addPlayerBody();
      return this.connector.setPosition(this.connector.spawnPosition);
    };

    Client.prototype.onClick = function() {
      var direction, intersection, obj, position, _i, _len, _ref;
      position = this.controls.getObject().position;
      direction = this.controls.getDirection(new THREE.Vector3);
      this.raycaster.set(position, direction);
      this.raycaster.far = 5.0;
      _ref = this.raycaster.intersectObjects(this.getAllClickableObjects());
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        intersection = _ref[_i];
        if (intersection.object && intersection.object.parent && intersection.object.parent.userData.is && intersection.object.parent.userData.is("link")) {
          intersection.object.parent.onClick();
        }
        obj = intersection.object;
        while (obj.parent) {
          if (obj.userData instanceof jQuery) {
            this.connector.onClick({
              uuid: obj.name,
              point: intersection.point
            });
            return;
          }
          obj = obj.parent;
        }
      }
    };

    Client.prototype.addMessageInput = function() {
      var input;
      this.chatForm = $("<div id='message-input'> <input type='text' placeholder='Press enter to start chatting...' /> </div>").appendTo("body");
      input = this.chatForm.find('input');
      $('body').on('keydown', (function(_this) {
        return function(e) {
          if (e.keyCode === 13 && !input.is(":focus")) {
            _this.chatForm.find('input').focus();
            _this.controls.enabled = false;
          }
          if (e.keyCode === 27) {
            return _this.disableControls();
          }
        };
      })(this));
      input.on('keydown', (function(_this) {
        return function(e) {
          if (e.keyCode === 13) {
            _this.addChatMessage({
              name: 'You'
            }, input.val());
            _this.connector.sendChat(input.val());
            input.val("").blur();
            _this.enableControls();
            e.preventDefault();
            return e.stopPropagation();
          }
        };
      })(this));
      return this.chatMessages = $("<div id='messages' />").hide().appendTo('body');
    };

    Client.prototype.addChatMessage = function(player, message) {
      this.chatMessages.show();
      if (player === null || player.name === 'scene') {
        $("<div />").text("" + message).addClass('scene-message').appendTo(this.chatMessages);
      } else {
        $("<div />").text("" + player.name + ": " + message).appendTo(this.chatMessages);
      }
      return this.chatMessages.scrollTop(this.chatMessages[0].scrollHeight);
    };

    Client.prototype.hideOverlays = function() {
      return $(".overlay").hide();
    };

    Client.prototype.showOverlays = function() {
      return $(".overlay").show();
    };

    Client.prototype.addConnectionError = function() {
      $(".overlay").remove();
      return this.renderOverlay(Templates.unableToConnect({
        host: URI.parse(this.connector.uri).host
      }));
    };

    Client.prototype.renderOverlay = function(html) {
      $(".overlay").remove();
      this.overlay = $("<div class='overlay'>").html(html).appendTo(this.container);
      return this.centerOverlay();
    };

    Client.prototype.centerOverlay = function() {
      if (this.overlay) {
        return this.overlay.css({
          left: ($(window).width() - this.overlay.width()) / 2 - 20,
          top: ($(window).height() - this.overlay.height()) / 2
        });
      }
    };

    Client.prototype.addConnecting = function() {
      return this.renderOverlay(Templates.connecting({
        host: URI.parse(this.connector.uri).host
      }));
    };

    Client.prototype.addInstructions = function() {
      var element;
      $(".overlay").remove();
      this.renderOverlay(Templates.instructions);
      element = document.body;
      if (!(MOBILE || element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock)) {
        alert("[FAIL] Your browser doesn't seem to support pointerlock. Please use ie, chrome or firefox.");
      }
    };

    Client.prototype.addPointLockGrab = function() {
      return $('body').click((function(_this) {
        return function() {
          var element;
          if (_this.controls.enabled) {
            return;
          }
          document.addEventListener('pointerlockchange', _this.pointerlockchange, false);
          document.addEventListener('mozpointerlockchange', _this.pointerlockchange, false);
          document.addEventListener('webkitpointerlockchange', _this.pointerlockchange, false);
          document.addEventListener('pointerlockerror', _this.pointerlockerror, false);
          document.addEventListener('mozpointerlockerror', _this.pointerlockerror, false);
          document.addEventListener('webkitpointerlockerror', _this.pointerlockerror, false);
          element = document.body;
          element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
          return element.requestPointerLock();
        };
      })(this));
    };

    Client.prototype.showMessage = function(message) {
      return this.renderOverlay(message);
    };

    Client.prototype.showInstructions = function() {
      return this.addInstructions();
    };

    Client.prototype.hideInstructions = function() {
      return $(".overlay").remove();
    };

    Client.prototype.addLoadingScene = function() {
      var geometry, material;
      geometry = new THREE.IcosahedronGeometry(500, 3);
      material = new THREE.MeshBasicMaterial({
        color: '#999999',
        wireframe: true,
        wireframeLinewidth: 1
      });
      this.loadingDome = new THREE.Mesh(geometry, material);
      return this.scene.add(this.loadingDome);
    };

    Client.prototype.addPlayerBody = function() {
      var lastContact, sphereShape;
      this.playerBody = new CANNON.Body({
        mass: 100
      });
      sphereShape = new CANNON.Sphere(0.5);
      this.playerBody.addShape(sphereShape);
      this.playerBody.position.set(0, 0, 0);
      this.playerBody.linearDamping = 0;
      this.world.add(this.playerBody);
      this.controls.setCannonBody(this.playerBody);
      lastContact = {
        time: 0,
        uuid: null
      };
      return this.playerBody.addEventListener("collide", (function(_this) {
        return function(e) {
          var contact, other;
          contact = e.contact;
          other = contact.bi.id === _this.playerBody.id ? contact.bj : contact.bi;
          if (other.uuid) {
            if (((new Date) - lastContact.time < 500) && (lastContact.uuid === other.uuid)) {
              return true;
            } else {
              lastContact = {
                time: new Date,
                uuid: other.uuid
              };
              return _this.connector.onCollide({
                uuid: other.uuid,
                normal: contact.ni
              });
            }
          }
        };
      })(this));
    };

    Client.prototype.addDot = function() {
      return $("<div />").addClass('aiming-point').appendTo('body');
    };

    Client.prototype.addControls = function() {
      this.controls = new PointerLockControls(this.camera, this, MOBILE);
      this.controls.enabled = false;
      return this.scene.add(this.controls.getObject());
    };

    Client.prototype.getPlayerObject = function() {
      return this.controls.getObject();
    };

    Client.prototype.getPlayerDropPoint = function() {
      var v;
      v = new THREE.Vector3(0, 0, -20);
      return this.getAvatarObject().position.clone().add(v.applyEuler(this.getAvatarObject().rotation));
    };

    Client.prototype.tickPhysics = function() {
      var timeStep;
      timeStep = 1.0 / PHYSICS_HZ;
      if (this.controls.enabled) {
        this.connector.physicsWorld.step(timeStep);
      }
      TWEEN.update();
      this.controls.update(Date.now() - this.time);
      return this.time = Date.now();
    };

    Client.prototype.tick = function() {
      var state;
      this.stats.begin();
      if (this.vrrenderer) {
        state = this.vrHMDSensor.getState();
        this.camera.quaternion.set(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w);
        this.vrrenderer.render(this.scene, this.camera, this.controls);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      if (this.connector.isPortalOpen()) {
        this.checkForPortalCollision();
      }
      this.stats.end();
      return requestAnimationFrame(this.tick);
    };

    Client.prototype.renderPortals = function() {
      var gl, originalCameraMatrixWorld, originalCameraProjectionMatrix;
      gl = this.renderer.context;
      originalCameraMatrixWorld = new THREE.Matrix4();
      originalCameraProjectionMatrix = new THREE.Matrix4();
      originalCameraMatrixWorld.copy(this.camera.matrixWorld);
      originalCameraProjectionMatrix.copy(this.camera.projectionMatrix);
      this.renderer.clear(true, true, true);
      gl.colorMask(false, false, false, false);
      gl.depthMask(false);
      gl.enable(gl.STENCIL_TEST);
      gl.stencilMask(0xFF);
      gl.stencilFunc(gl.NEVER, 0, 0xFF);
      gl.stencilOp(gl.INCR, gl.KEEP, gl.KEEP);
      this.renderer.render(this.connector.stencilScene, this.camera);
      gl.colorMask(true, true, true, true);
      gl.depthMask(true);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      this.renderer.clear(false, true, false);
      gl.stencilFunc(gl.LESS, 0, 0xff);
      this.renderer.render(this.connector.portal.scene, this.camera);
      gl.disable(gl.STENCIL_TEST);
      this.renderer.clear(false, false, true);
      this.camera.matrixWorld.copy(originalCameraMatrixWorld);
      this.camera.projectionMatrix.copy(originalCameraProjectionMatrix);
      this.renderer.clear(false, true, false);
      gl.colorMask(false, false, false, false);
      gl.depthMask(true);
      this.renderer.render(this.connector.stencilScene, this.camera);
      gl.colorMask(true, true, true, true);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      this.renderer.render(this.scene, this.camera);
      return this.camera.projectionMatrix.copy(originalCameraProjectionMatrix);
    };

    return Client;

  })(EventEmitter);

  module.exports = Client;

}).call(this);
