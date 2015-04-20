var util = require('util');
var Connector = require('./connector');
var environment = require('./environment');
var URI = require('uri-js');
var TWEEN = require('tween.js');
var CANNON = require('cannon');
var EventEmitter = require('wolfy87-eventemitter');
var Authentication = require('./authentication');
var Preferences = require('./preferences');
var AssetManager = require('./asset_manager');

// For semistandard
var $ = window.jQuery;
var Stats = window.Stats;
var THREE = window.THREE;

var Templates = {
  inQueue: require('../templates/in_queue.jade'),
  unableToConnect: require('../templates/unable_to_connect.jade'),
  instructions: require('../templates/instructions.jade'),
  connecting: require('../templates/connecting.jade')
};

// Not sure why this has to be global
window.CANNON = CANNON;

function Client () {
  this.initialize();
}

util.inherits(Client, EventEmitter);

Client.prototype.initialize = function () {
  var self = this;

  this.assetManager = new AssetManager(this);
  this.preferences = new Preferences(this);
  this.environment = environment;

  this.container = $('#scene-view');
  this.width = this.container.width();
  this.height = this.container.height();
  window.addEventListener('resize', this.onWindowResize.bind(this), false);

  this.createStats();

  this.authentication = new Authentication(this);

  // Register event handlers
  this.on('click', this.onClick.bind(this));

  this.scene = new THREE.Scene();
  var aspect = this.width / this.height;
  this.camera = new THREE.PerspectiveCamera(environment.getViewAngle(), aspect, environment.getNear(), environment.getFar());
  this.initializeRenderer();
  this.addControls();

  if (environment.isDebug()) {
    this.addDirectionArrow();
  }

  this.addDot();

  // Init physics
  this.world = new CANNON.World();
  this.world.gravity.set(0, -20, 0);
  this.world.broadphase = new CANNON.NaiveBroadphase();
  this.addPlayerBody();

  // Init connector
  this.connector = new Connector(this, this.scene, this.world, this.getUrlFromLocation());
  this.connector.connect();
  this.addConnecting();

  if (!environment.isMobile()) {
    this.addMessageInput();
    this.addPointLockGrab();
  }

  this.connector.on('connected', function () {
    if (environment.isMobile()) {
      self.enableControls();
    } else {
      self.addInstructions();
    }

    if (environment.isEditingEnabled()) {
      // self.editor = new Editor(self);
    }
  });

  this.connector.on('disconnected', function () {
    self.addConnectionError();
  });

  this.connector.on('restarting', function () {
    self.showMessage('Reconnecting...');
  });

  this.raycaster = new THREE.Raycaster();

  this.tick();

  this.preferences.createGui();

  // Start physics
  this.physicsInterval = setInterval(this.tickPhysics.bind(this), 1000 / environment.physicsHertz());
};

Client.prototype.updateVolume = function () {
  this.connector.getAudioElements().forEach(function (el) {
    el.updateVolume();
  });
};

Client.prototype.stop = function () {
  this.stopped = true;
  this.connector.disconnect();
  clearInterval(this.physicsInterval);
};

Client.prototype.createStats = function () {
  this.stats = {};

  this.stats.rendering = new Stats();
  this.stats.rendering.setMode(0);
  this.stats.rendering.domElement.style.position = 'absolute';
  this.stats.rendering.domElement.style.bottom = '10px';
  this.stats.rendering.domElement.style.zIndex = 110;
  this.stats.rendering.domElement.style.right = '10px';
  this.container.append(this.stats.rendering.domElement);

  this.stats.physics = new Stats();
  this.stats.physics.setMode(1);
  this.stats.physics.domElement.style.position = 'absolute';
  this.stats.physics.domElement.style.bottom = '70px';
  this.stats.physics.domElement.style.zIndex = 110;
  this.stats.physics.domElement.style.right = '10px';
  this.container.append(this.stats.physics.domElement);

  this.stats.connector = new Stats();
  this.stats.connector.setMode(1);
  this.stats.connector.domElement.style.position = 'absolute';
  this.stats.connector.domElement.style.bottom = '130px';
  this.stats.connector.domElement.style.zIndex = 110;
  this.stats.connector.domElement.style.right = '10px';
  this.container.append(this.stats.connector.domElement);
};

Client.prototype.initializeRenderer = function () {
  if (this.renderer) {
    throw new Error('Cannot reinitialize');
  }

  this.domElement = $('<canvas />');
  this.container.append(this.domElement);

  this.renderer = new THREE.WebGLRenderer({
    antialias: this.preferences.getState().graphicsAntialiasing,
    canvas: this.domElement[0]
  });

  this.renderer.setSize(this.width / this.preferences.getState().downSampling, this.height / this.preferences.getState().downSampling);
  this.renderer.setClearColor(0x000000);
  this.renderer.autoClear = false;

  this.domElement.css({
    width: this.width,
    height: this.height
  });
};

Client.prototype.onWindowResize = function () {
  this.width = this.container.width();
  this.height = this.container.height();

  this.camera.aspect = this.width / this.height;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(this.width / this.preferences.getState().downSampling, this.height / this.preferences.getState().downSampling);

  this.domElement.css({
    width: this.width,
    height: this.height
  });

  this.centerOverlay();
};

Client.prototype.enableControls = function () {
  this.controls.enabled = true;
  this.hideInstructions();
};

Client.prototype.disableControls = function () {
  this.controls.enabled = false;
};

Client.prototype.getUrlFromLocation = function () {
  if (window.location.search.match(/connect.+/)) {
    return '//' + window.location.search.split(/[=]/)[1];
  } else {
    return '//home.scenevr.hosting/home.xml';
  }
};

Client.prototype.removeAllObjectsFromScene = function () {
  var self = this;
  var children = Array.prototype.slice.apply(this.scene.children);

  children.forEach(function (child) {
    if (child.body) {
      self.world.remove(child.body);
    }

    if (child === self.controls.getObject()) {
      // ...
    } else {
      self.scene.remove(child);
    }
  });
};

Client.prototype.getAllClickableObjects = function () {
  var list = [];

  this.scene.traverse(function (obj) {
    return list.push(obj);
  });

  return list;
};

Client.prototype.consoleLog = function (msg) {
  this.addChatMessage({
    name: 'Client'
  }, msg);
};

Client.prototype.checkForPortalCollision = function () {
  var position = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());
  this.raycaster.set(position, direction);
  this.raycaster.far = 0.5;

  var ints = this.raycaster.intersectObject(this.connector.stencilScene.children[0], false);

  if ((ints.length > 0) && (this.connector.portal.connector.hasSpawned())) {
    return this.promotePortal();
  }
};

Client.prototype.promotePortal = function () {
  this.portal = this.connector.portal;

  this.connector.sendChat('/entered ' + URI.serialize(this.portal.connector.uri).slice(0, 30) + '...');
  window.history.pushState({}, 'SceneVR', '?connect=' + URI.serialize(this.portal.connector.uri).replace(/^\/\//, ''));

  var controlObject = this.controls.getObject();

  this.scene.remove(controlObject);
  this.world.remove(this.playerBody);
  this.world = this.portal.world;
  this.scene = this.portal.scene;
  this.scene.add(controlObject);

  this.connector.destroy();
  delete this.connector;

  this.connector = this.portal.connector;
  this.connector.isPortal = false;

  delete this.portal;
  delete this.playerBody;

  this.world.gravity.set(0, -20, 0);
  this.world.broadphase = new CANNON.NaiveBroadphase();
  this.addPlayerBody();
  this.connector.setPosition(this.connector.spawnPosition);
};

Client.prototype.onClick = function (e) {
  var position = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());

  this.raycaster.set(position, direction);
  this.raycaster.far = 5.0;

  if (environment.isDebug()) {
    // Add an arrow showing where the click ray is being cast.
    var material = new THREE.LineBasicMaterial({
        color: 0x0000ff,
        linewidth: 5
    });

    var geometry = new THREE.Geometry();
    geometry.vertices.push(position.clone());
    geometry.vertices.push(position.clone().add(direction.multiplyScalar(5.0)));

    var line = new THREE.Line(geometry, material);
    this.scene.add(line);
  }

  var _i, _len, _ref = this.raycaster.intersectObjects(this.getAllClickableObjects());

  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    var intersection = _ref[_i];

    if (intersection.object && intersection.object.parent && intersection.object.parent.userData.is && intersection.object.parent.userData.is('link')) {
      intersection.object.parent.onClick();
    }

    var obj = intersection.object;

    while (obj.parent) {
      if (obj.userData instanceof window.jQuery) {
        if (this.editor) {
          this.editor.trigger('object:click', [obj]);
        } else {
          this.connector.onClick({
            uuid: obj.name,
            point: intersection.point
          });
        }

        return;
      }
      obj = obj.parent;
    }
  }

  if (this.editor) {
    this.editor.trigger('object:click');
  }
};

Client.prototype.addMessageInput = function () {
  var self = this;

  this.chatForm = $('<div id=\'message-input\'> <input type=\'text\' placeholder=\'Press enter to start chatting...\' /> </div>').appendTo('body');

  var input = this.chatForm.find('input');

  $('body').on('keydown', function (e) {
    if (e.keyCode === 13 && !input.is(':focus')) {
      self.chatForm.find('input').focus();
      self.controls.enabled = false;
    }

    if (e.keyCode === 27) {
      self.disableControls();
    }
  });

  input.on('keydown', function (e) {
    if (e.keyCode === 27) {
      input.text('').blur();
      self.enableControls();
    }

    if (e.keyCode === 13) {
      if (input.val() !== '') {
        self.addChatMessage({
          name: 'You'
        }, input.val());

        self.connector.sendChat(input.val());
      }

      self.enableControls();
      input.val('').blur();

      e.preventDefault();
      e.stopPropagation();
    }
  });

  this.chatMessages = $("<div id='messages' />").hide().appendTo('body');
};

Client.prototype.addChatMessage = function (player, message) {
  this.chatMessages.show();

  if (player === null || player.name === 'scene') {
    $('<div />').text('' + message).addClass('scene-message').appendTo(this.chatMessages);
  } else {
    if (message.match(/^\/entered/)) {
      $('<div />').addClass('message action').text(
        player.name + ' ' + message.replace(/^.entered/, ' left through the portal to ')
      ).appendTo(this.chatMessages);
    } else {
      $('<div />').text('' + player.name + ': ' + message).appendTo(this.chatMessages);
    }
  }

  this.chatMessages.scrollTop(this.chatMessages[0].scrollHeight);
};

Client.prototype.hideOverlays = function () {
  return $('.overlay').hide();
};

Client.prototype.showOverlays = function () {
  return $('.overlay').show();
};

Client.prototype.addConnectionError = function () {
  $('.overlay').remove();

  this.renderOverlay(Templates.unableToConnect({
    host: this.connector.uri.host
  }));
};

Client.prototype.renderOverlay = function (el) {
  if (typeof el === 'function') {
    el = $('<div />').html(el());
  } else if (typeof el === 'string') {
    el = $('<div />').html(el);
  }

  $('.overlay').remove();

  this.overlay = $('<div class="overlay" />').append(el).appendTo(this.container);
  this.centerOverlay();
  this.exitPointerLock();

  this.overlay;
};

Client.prototype.centerOverlay = function () {
  if (this.overlay) {
    this.overlay.css({
      left: ($(window).width() - this.overlay.width()) / 2 - 20,
      top: ($(window).height() - this.overlay.height()) / 2
    });
  }
};

Client.prototype.addConnecting = function () {
  this.renderOverlay(Templates.connecting({
    host: this.connector.uri.host
  }));
};

Client.prototype.supportsPointerLock = function () {
  var element = document.body;
  return !!(element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock);
};

Client.prototype.addInstructions = function () {
  $('.overlay').remove();

  this.renderOverlay(Templates.instructions({
    supportsPointerLock: this.supportsPointerLock()
  }));
};

Client.prototype.exitPointerLock = function () {
  if (document.exitPointerLock) {
    document.exitPointerLock();
  } else if (document.mozExitPointerLock) {
    document.mozExitPointerLock();
  }
};

Client.prototype.requestPointerLock = function () {
  var self = this;
  var el = this.domElement[0];

  if (el.requestPointerLock) {
    el.requestPointerLock();
  } else if (el.mozRequestPointerLock) {
    el.mozRequestPointerLock();
  } else {
    this.domElement.click(function (e) {
      if (!self.controls.enabled) {
        self.enableControls();
      }
    });
  }
};

Client.prototype.hasPointerLock = function () {
  return document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
};

Client.prototype.pointerLockError = function (event) {
  console.error('[FAIL] There was an error acquiring pointerLock.');
};

Client.prototype.pointerLockChange = function (event) {
  if (this.hasPointerLock()) {
    this.enableControls();
  } else {
    this.disableControls();
  }
};

Client.prototype.addPointLockGrab = function () {
  document.addEventListener('pointerlockchange', this.pointerLockChange.bind(this), false);
  document.addEventListener('pointerlockerror', this.pointerLockError.bind(this), false);

  document.addEventListener('mozpointerlockchange', this.pointerLockChange.bind(this), false);
  document.addEventListener('mozpointerlockerror', this.pointerLockError.bind(this), false);

  document.addEventListener('webkitpointerlockchange', this.pointerLockChange.bind(this), false);
  document.addEventListener('webkitpointerlockerror', this.pointerLockError.bind(this), false);

  var self = this;

  this.domElement.click(function () {
    if (self.controls.enabled) {
      return;
    }

    self.requestPointerLock();
  });
};

Client.prototype.showMessage = function (message) {
  this.renderOverlay(message);
};

Client.prototype.showInstructions = function () {
  this.addInstructions();
};

Client.prototype.hideInstructions = function () {
  $('.overlay').remove();
};

Client.prototype.addDirectionArrow = function () {
  var material = new THREE.LineBasicMaterial({
      color: 0x0ffff00,
      linewidth: 10
  });
  var geometry = new THREE.Geometry();
  geometry.vertices.push(new THREE.Vector3(0, 0.2, 0));
  geometry.vertices.push(new THREE.Vector3(0, 0.2, -5));
  this.directionArrow = new THREE.Line(geometry, material);
  this.scene.add(this.directionArrow);
};

Client.prototype.addPlayerBody = function () {
  var self = this;

  this.playerBody = new CANNON.Body({
    mass: 100
  });

  var sphereShape = new CANNON.Sphere(0.5);

  this.playerBody.addShape(sphereShape);
  this.playerBody.position.set(0, 0, 0);
  this.playerBody.linearDamping = 0;
  this.world.add(this.playerBody);
  this.controls.setCannonBody(this.playerBody);

  // :/
  var lastContact = {
    time: 0,
    uuid: null
  };

  this.playerBody.addEventListener('collide', function (e) {
    var contact = e.contact;
    var other = contact.bi.id === self.playerBody.id ? contact.bj : contact.bi;

    if (other.uuid) {
      if (((new Date()) - lastContact.time < 500) && (lastContact.uuid === other.uuid)) {
        return true;
      } else {
        lastContact = {
          time: new Date(),
          uuid: other.uuid
        };

        self.connector.onCollide({
          uuid: other.uuid,
          normal: contact.ni
        });
      }
    }
  });
};

Client.prototype.addDot = function () {
  $('<div />').addClass('aiming-point').appendTo('body');
};

Client.prototype.addControls = function () {
  var self = this;

  this.controls = new window.PointerLockControls(this.camera, this, environment.isMobile(), this.supportsPointerLock());
  this.controls.enabled = false;
  this.scene.add(this.controls.getObject());

  $('body').keydown(function (e) {
    if ($('input:focus')[0] === undefined) {
      if ((e.keyCode === 84) || (e.keyCode === 86)) {
        self.connector.startTalking();
      }

      if (e.charCode === 'f'.charCodeAt(0)) {
        self.consoleLog('Rift support has been deprecated. Use JanusVR to view scenes in the rift.');
      }
    }
  });

  $('body').keyup(function (e) {
    if ($('input:focus')[0] === undefined) {
      if ((e.keyCode === 84) || (e.keyCode === 86)) {
        self.connector.stopTalking();
      }
    }
  });
};

Client.prototype.getPlayerObject = function () {
  return this.controls.getObject();
};

Client.prototype.getRotation = function () {
  return this.controls.getRotation();
};

Client.prototype.tickPhysics = function () {
  var timeStep = 1.0 / environment.physicsHertz();

  this.stats.physics.begin();

  this.connector.physicsWorld.step(timeStep);

  TWEEN.update();

  // Get click event from the gamepad
  if (this.controls.getObject().click) {
    this.onClick();
  }

  this.controls.update(timeStep * 1000);
  this.trigger('controls:update', [this.controls]);
  this.stats.physics.end();
};

Client.prototype.tick = function () {
  if (this.stopped) {
    return;
  }

  this.stats.rendering.begin();

  if (environment.isDebug()) {
    var q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.controls.getYaw());
    this.directionArrow.quaternion.copy(q);
    this.directionArrow.position.copy(this.controls.getPosition()).setY(0.1);
  }

  if (this.preferences.gui) {
    this.preferences.gui.update({
      position: this.controls.getPosition().clone().add(new THREE.Vector3(-1.25, 2.0, -2))
    });
  }

  this.renderer.render(this.scene, this.camera);

  if (this.connector.isPortalOpen()) {
    this.checkForPortalCollision();
  }

  this.stats.rendering.end();

  if (environment.isLowPowerMode()) {
    setTimeout(this.tick.bind(this), 1000 / 12);
  } else {
    window.requestAnimationFrame(this.tick.bind(this));
  }
};

Client.prototype.renderPortals = function () {
  var gl = this.renderer.context;
  var originalCameraMatrixWorld = new THREE.Matrix4();
  var originalCameraProjectionMatrix = new THREE.Matrix4();

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
  this.camera.projectionMatrix.copy(originalCameraProjectionMatrix);
};

module.exports = Client;
