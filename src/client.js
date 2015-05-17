var $ = require('jQuery');
var THREE = require('three');
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
var PointerLockControls = require('./controls');
var Stats = require('stats-js');

var Templates = {
  inQueue: require('../templates/in_queue.jade'),
  unableToConnect: require('../templates/unable_to_connect.jade'),
  instructions: require('../templates/instructions.jade'),
  connecting: require('../templates/connecting.jade')
};

// Not sure why this has to be global
window.CANNON = CANNON;

function Client (container, options) {
  this.container = $(container);
  this.options = options;
}

util.inherits(Client, EventEmitter);

Client.prototype.initialize = function () {
  $('.sk-spinner').remove();

  this.assetManager = new AssetManager(this);
  this.preferences = new Preferences(this);
  this.raycaster = new THREE.Raycaster();
  this.createStats();
  this.authentication = new Authentication(this);
  this.createCamera();
  this.initializeRenderer();
  this.addControls();

  // Register event handlers
  this.on('click', this.onClick.bind(this));

  if (environment.isMobile()) {
    $('body').addClass('mobile');
    $('html,body').on('touchstart touchmove', function (e) {
      // prevent native touch activity like scrolling
      e.preventDefault();
    });
  } else {
    this.addMessageInput();
    this.addPointLockGrab();
  }

  // Start renderer
  this.tick();
};

Client.prototype.createCamera = function () {
  var width = this.container.width();
  var height = this.container.height();
  var aspect = width / height;
  this.camera = new THREE.PerspectiveCamera(environment.getViewAngle(), aspect, environment.getNear(), environment.getFar());
};

Client.prototype.unloadScene = function () {
  this.scene.remove(this.controls.getObject());
  this.world.remove(this.playerBody);

  // Todo - do we need to iterate over children and remove them?

  delete this.scene;
  delete this.world;
};

Client.prototype.loadScene = function (url) {
  var self = this;

  if (this.connector) {
    this.unloadScene();
    this.connector.destroy();
    delete this.connector;
  }

  // Init scene
  this.scene = new THREE.Scene();
  this.scene.add(this.controls.getObject());

  // Init physics
  this.world = new CANNON.World();
  this.world.gravity.set(0, -20, 0);
  this.world.broadphase = new CANNON.NaiveBroadphase();
  this.addPlayerBody();

  // Init connector
  this.connector = new Connector(this, this.scene, this.world, url);
  this.connector.connect();
  this.addConnecting();

  this.connector.on('connected', function () {
    if (environment.isMobile()) {
      self.enableControls();
    } else {
      self.addInstructions();
    }

    self.setTitle();
  });

  this.connector.on('disconnected', function () {
    self.addConnectionError();
  });

  this.connector.on('restarting', function () {
    self.showMessage('Reconnecting...');
  });
};

Client.prototype.promotePortal = function () {
  this.portal = this.connector.portal;

  this.trigger('enterportal', [{
    url: this.portal.connector.getUrl(),
    position: this.getPlayerObject().position,
    rotation: this.getRotation()
  }]);

  this.connector.sendChat('/entered ' + URI.serialize(this.portal.connector.uri).slice(0, 30) + '...');

  this.unloadScene();

  var controlObject = this.controls.getObject();
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

  this.setTitle();
};

Client.prototype.updateVolume = function () {
  this.connector.getAudioElements().forEach(function (el) {
    el.updateVolume();
  });
};

Client.prototype.isConnected = function () {
  return this.connector && this.connector.isConnected();
};

Client.prototype.getSceneUrl = function () {
  return this.isConnected() ? this.connector.getUrl() : null;
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

  this.stats.connector = new Stats();
  this.stats.connector.setMode(1);
  this.stats.connector.domElement.style.position = 'absolute';
  this.stats.connector.domElement.style.bottom = '70px';
  this.stats.connector.domElement.style.zIndex = 110;
  this.stats.connector.domElement.style.right = '10px';
  if (environment.isMobile()) {
    this.stats.connector.domElement.style.display = 'none';
  }
  this.container.append(this.stats.connector.domElement);
};

Client.prototype.initializeRenderer = function () {
  if (this.renderer) {
    throw new Error('Cannot reinitialize');
  }

  var width = this.container.width();
  var height = this.container.height();

  this.domElement = $('<canvas />');
  this.container.append(this.domElement);

  this.domElement.css({
    width: width,
    height: height,
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20
  });

  this.renderer = new THREE.WebGLRenderer({
    antialias: this.preferences.getState().graphicsAntialiasing,
    alpha: false,
    // precision: 'lowp',
    canvas: this.domElement[0]
  });

  this.renderer.setSize(width / this.preferences.getState().downSampling, height / this.preferences.getState().downSampling);
  this.renderer.setClearColor(0xFFFFFF);
  this.renderer.autoClear = true;
  this.renderer.sortObjects = false;
  this.renderer.shadowMapEnabled = false;

  window.addEventListener('resize', this.onWindowResize.bind(this), false);
};

Client.prototype.onWindowResize = function () {
  var width = this.container.width();
  var height = this.container.height();

  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(width / this.preferences.getState().downSampling, height / this.preferences.getState().downSampling);

  this.domElement.css({
    width: width,
    height: height
  });

  this.centerOverlay();
};

Client.prototype.enableControls = function () {
  this.controls.enabled = true;
  this.hideInstructions();
  this.reticule.show();
};

Client.prototype.disableControls = function () {
  this.controls.enabled = false;
  this.reticule.hide();
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

Client.prototype.setTitle = function () {
  document.title = 'Scene :: ' + this.connector.getTitle();
};

Client.prototype.inspect = function (el) {
  this.connector.inspectElement(el);
};

Client.prototype.inspectResult = function (el) {
  // var textarea = $('#editor textarea');
  // var src = textarea.val();
  // var startIndex = parseInt(el.attr('startindex'), 10);
  // var newLines = src.substr(0, startIndex).match(/\n/g) || [];
  // var lineNumber = newLines.length + 1;

  // console.log(startIndex);
  // console.log(lineNumber);

  // textarea.focus();
  // textarea[0].selectionStart = startIndex;
  // this.client.exitPointerLock();
};

Client.prototype.onClick = function (e) {
  var position = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());

  this.raycaster.set(position, direction);
  this.raycaster.far = 5.0;

  var _i, _len, _ref = this.raycaster.intersectObjects(this.getAllClickableObjects());

  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    var intersection = _ref[_i];

    if (intersection.object && intersection.object.parent && intersection.object.parent.userData.is && intersection.object.parent.userData.is('link')) {
      intersection.object.parent.onClick();
    }

    var obj = intersection.object;

    while (obj.parent) {
      if (obj.userData instanceof $) {
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
        self.postChatMessage(input.val());
      }

      self.enableControls();
      input.val('').blur();

      e.preventDefault();
      e.stopPropagation();
    }
  });

  this.chatMessages = $("<div id='messages' />").hide().appendTo('body');
};

Client.prototype.postChatMessage = function (message) {
  this.addChatMessage({
    name: 'You'
  }, message);

  this.connector.sendChat(message);
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

  var w = $(window).width();

  if (this.overlay.width() > w) {
    this.overlay.css('width', w - 50);
  }

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

Client.prototype.addReticule = function () {
  this.reticule = $('<div />').addClass('aiming-point').appendTo('body');
};

Client.prototype.addControls = function () {
  var self = this;

  this.controls = new PointerLockControls(this.camera, this, environment.isMobile(), this.supportsPointerLock());
  this.controls.enabled = false;

  this.addReticule();

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

Client.prototype.getVelocity = function () {
  return this.controls.getVelocity();
};

Client.prototype.tickPhysics = function () {
  var now = new Date().valueOf();

  var timeStep = now - this.lastTime;

  if (this.stopped) {
    return;
  }

  if (!this.world) {
    return;
  }

  if (this.lastTime) {
    if ((timeStep < 1000) && (this.controls.enabled)) {
      this.connector.physicsWorld.step(Math.min(40, timeStep) / 1000.0);
    }

    TWEEN.update();

    // Get click event from the gamepad
    if (this.controls.getObject().click) {
      this.onClick();
    }

    this.controls.update(timeStep);
    this.trigger('controls:update', [this.controls]);
  }

  this.lastTime = now;
};

Client.prototype.tick = function () {
  if (!this.stopped && this.scene) {
    this.stats.rendering.begin();

    this.renderer.render(this.scene, this.camera);

    if (this.connector.isPortalOpen()) {
      this.checkForPortalCollision();
    }

    this.stats.rendering.end();

    this.tickPhysics();
  }

  if (environment.isLowPowerMode()) {
    setTimeout(this.tick.bind(this), 1000 / 12);
  } else {
    window.requestAnimationFrame(this.tick.bind(this));
  }
};

module.exports = Client;
