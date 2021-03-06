var $ = require('jquery');
var THREE = require('three');
var util = require('util');
var Connector = require('./connector');
var environment = require('./environment');
var TWEEN = require('tween.js');
var CANNON = require('cannon');
var EventEmitter = require('wolfy87-eventemitter');
var Authentication = require('./authentication');
var Preferences = require('./preferences');
var AssetManager = require('./asset-manager');
var PointerLockControls = require('./controls');
var Editor = require('./editor');
var Utilities = require('../vendor/webvr-manager/util');
var VrButton = require('./components/vr-button');
var WebvrDetector = require('./lib/webvr-detector');
var Voice = require('./voice');
var DebugStats = require('./debug-stats');

require('../vendor/rstats');

// sadface
window.THREE = THREE;

window.WebVRConfig = {
  // Complementary filter coefficient. 0 for accelerometer, 1 for gyro.
  // K_FILTER: 0.98, // Default: 0.98.

  // How far into the future to predict during fast motion.
  // PREDICTION_TIME_S: 0.100 // Default: 0.050s.
};

// VR Controls
require('webvr-polyfill');
require('three/examples/js/controls/VRControls.js');
require('three/examples/js/effects/VREffect.js');

var Effects = {
  Vanilla: require('./effects/vanilla'),
  Stereoscopic: require('./effects/stereoscopic'),
  Portal: require('./effects/portal')
};

var Templates = {
  unableToConnect: function (args) {
    return '<div class="unable-to-connect"><h1>Unable to connect</h1><p>Scene is unable to connect to <b>' + args.host + '</b><p>The server may be down, or you may be experiencing connection difficulties. Reload this page to try and reconnect.';
  },
  instructions: function (args) {
    return '<div id="instructions"><h1>Click on the scene to join</h1><p>' +
      (args.supportsPointerLock ? 'W, A, S, D = Move, SPACE = jump, MOUSE = Look around' : 'Hold shift to run. Hold V or T for voice chat.') +
      '</p><p>Arrow keys = Move, SPACE = jump</p><p>Click the orange globes to open portals.';
  },
  connecting: function (args) {
    return '<div class="connecting"><h1>Connecting</h1><p>SceneVR is connecting to <b>' + args.host + '</b>';
  }
};

// Not sure why this has to be global
window.CANNON = CANNON;

var DEFAULT_OPTIONS = {
  mouselook: true,
  debug: false
};

function Client (container, options) {
  this.container = $(container);
  this.options = Object.assign(DEFAULT_OPTIONS, options);
}

util.inherits(Client, EventEmitter);

Client.prototype.setOptions = function (options) {
  Object.assign(this.options, options);

  if (options.mouselook === false) {
    this.releasePointerLock();
  }
};

Client.prototype.initialize = function () {
  var self = this;

  $('.sk-spinner').remove();

  this.voice = new Voice(this);
  this.voice.start();

  this.debug = new DebugStats(this);

  this.assetManager = new AssetManager(this);
  this.preferences = new Preferences(this);
  this.raycaster = new THREE.Raycaster();
  this.createStats();
  this.authentication = new Authentication(this);
  this.createCamera();
  this.createRenderer();
  this.createScene();
  this.addControls();

  WebvrDetector(function (err, device) {
    if (err) {
      throw err;
    }

    if (device) {
      self.addVRButton(self.onEnterVR.bind(self, device));
      self.addVRHandlers();
    }
  });

  // this.addEditor();

  if (Utilities.isMobile()) {
    $('body').addClass('mobile');
    $('html,body').on('touchstart touchmove', function (e) {
      // prevent native touch activity like scrolling
      e.preventDefault();
    });
    $('#stats, #view-source, header').hide();

    // Apply VR stereo rendering to renderer.
    this.vreffect = new THREE.VREffect(this.renderer);
    this.vreffect.setSize(window.innerWidth, window.innerHeight);
  } else {
    this.addMessageInput();
    this.addPointLockGrab();
  }

  // Start renderer
  this.tick();
};

Client.prototype.addVRButton = function (callback) {
  this.vrButton = VrButton(callback);
  this.container[0].appendChild(this.vrButton);
};

Client.prototype.addVRHandlers = function () {
  var self = this;

  this.vreffect = new THREE.VREffect(this.renderer);
  this.vreffect.setSize(window.innerWidth, window.innerHeight);

  function exitFullscreen () {
    if (document.webkitFullscreenElement === null || document.mozFullScreenElement === null) {
      self.effect = new Effects.Vanilla(self, self.renderer);
      self.hmd = null;
    }
  }

  document.addEventListener('webkitfullscreenchange', exitFullscreen);
  document.addEventListener('mozfullscreenchange', exitFullscreen);
};

Client.prototype.onEnterVR = function (hmd) {
  this.vreffect.setFullScreen(true);
  this.hmd = hmd;
};

Client.prototype.addEditor = function () {
  this.editor = new Editor(this);
};

Client.prototype.createScene = function () {
  this.setScene(new THREE.Scene());
};

Client.prototype.setScene = function (scene) {
  this.scene = scene;
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

Client.prototype.loadScene = function (sceneProxy, position) {
  var self = this;

  this.url = sceneProxy;

  if (this.connector) {
    this.unloadScene();
    this.connector.destroy();
    delete this.connector;
  }

  // Init scene
  this.setScene(new THREE.Scene());
  this.scene.add(this.controls.getObject());

  // Init physics
  this.world = new CANNON.World();
  this.world.gravity.set(0, -20, 0);
  this.world.broadphase = new CANNON.NaiveBroadphase();
  this.addPlayerBody();

  // Init connector
  var connector = new Connector(this, this.scene, this.world, sceneProxy);
  connector.connect();
  this.connector = connector;
  this.addConnecting();

  connector.on('connected', function () {
    if (environment.isMobile()) {
      self.takePointerLock();
    } else if (this.controls && this.controls.gamepad.present()) {
      self.controls.enabled = true;
      self.hideInstructions();
    } else {
      self.addInstructions();
    }

    self.setTitle();
  });

  connector.on('disconnected', function () {
    self.addConnectionError();
  });

  connector.on('restarting', function () {
    self.showMessage('Reconnecting...');
  });
};

Client.prototype.promotePortal = function () {
  var portal = this.connector.portal;

  this.trigger('enterportal', [{
    url: portal.connector.getUrl(),
    position: this.getPlayerObject().position,
    rotation: this.getRotation()
  }]);

  this.connector.sendChat('/entered ' + portal.connector.getTitle().slice(0, 30) + '...');
  this.unloadScene();

  this.world = portal.world;
  this.setScene(portal.scene);
  this.scene.add(this.controls.getObject());

  this.connector.destroy();
  delete this.connector;

  this.connector = portal.connector;
  this.connector.isPortal = false;

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

Client.prototype.isCardboard = function () {
  return Utilities.isMobile();
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
  this.stats = new rStats({
    values: {
        fps: { caption: 'Framerate (FPS)', below: 30, color: '#ff7700' },
      }
  });

  // this.stats = {};

  // this.stats.rendering = new Stats();
  // this.stats.rendering.setMode(0);
  // this.stats.rendering.domElement.style.position = 'absolute';
  // this.stats.rendering.domElement.style.bottom = '10px';
  // this.stats.rendering.domElement.style.zIndex = 110;
  // this.stats.rendering.domElement.style.right = '10px';
  // this.container.append(this.stats.rendering.domElement);

  // this.stats.connector = new Stats();
  // this.stats.connector.setMode(1);
  // this.stats.connector.domElement.style.position = 'absolute';
  // this.stats.connector.domElement.style.bottom = '70px';
  // this.stats.connector.domElement.style.zIndex = 110;
  // this.stats.connector.domElement.style.right = '10px';
  // if (environment.isMobile()) {
  //   this.stats.connector.domElement.style.display = 'none';
  // }
  // this.container.append(this.stats.connector.domElement);
};

Client.prototype.createRenderer = function () {
  if (this.renderer) {
    throw new Error('Cannot reinitialize');
  }

  var width = this.container.width();
  var height = this.container.height();

  this.domElement = $('<canvas />');
  this.canvas = this.domElement[0];
  this.container.append(this.domElement);

  this.domElement.css({
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20
  });

  this.renderer = new THREE.WebGLRenderer({
    antialias: environment.antiAliasingEnabled(),
    alpha: false,
    canvas: this.domElement[0],
    preserveDrawingBuffer: true
  });
  this.renderer.setPixelRatio(window.devicePixelRatio);

  this.renderer.setSize(width / environment.getDownsampling(), height / environment.getDownsampling());
  this.renderer.setClearColor(0xFFFFFF);
  // this.renderer.autoClear = true;
  // this.renderer.sortObjects = false;
  this.renderer.shadowMap.enabled = environment.shadowMappingEnabled();

  if (environment.shadowMappingEnabled()) {
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.bias = -0.0001;
  }

  this.domElement[0].style.width = '100%';
  this.domElement[0].style.height = '100%';

  this.effect = new Effects.Vanilla(this, this.renderer);

  window.addEventListener('resize', this.onWindowResize.bind(this), false);
};

Client.prototype.onWindowResize = function () {
  var width = this.container.width();
  var height = this.container.height();

  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(width / environment.getDownsampling(), height / environment.getDownsampling());

  this.domElement[0].style.width = '100%';
  this.domElement[0].style.height = '100%';

  this.centerOverlay();
};

Client.prototype.takePointerLock = function () {
  if (!this.options.mouselook) {
    return;
  }

  this.controls.enabled = true;
  this.hideInstructions();

  if (!Utilities.isMobile()) {
    this.reticule.show();
  }
};

Client.prototype.releasePointerLock = function () {
  this.controls.enabled = false;
  this.reticule.hide();
  this.exitPointerLock();
};

Client.prototype.getDropPosition = function (distance) {
  var player = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());

  if (!distance) {
    distance = 2;
  }

  return player.clone().add(direction.multiplyScalar(distance));
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

Client.prototype.setTitle = function () {
  document.title = 'SceneVR - ' + this.connector.getTitle();
};

Client.prototype.inspect = function (el) {
  this.connector.inspectElement(el);
};

Client.prototype.getElementsFromPoint = function (point, distance) {
  if (!point) {
    point = new THREE.Vector2(this.container.innerWidth / 2, this.container.innerHeight / 2);
  }

  if (!distance) {
    distance = 5.0;
  }

  var results = [];

  var position = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());

  this.raycaster.set(position, direction);
  this.raycaster.far = distance;

  // fixme - the search for the userData node is pretty ganky
  this.raycaster.intersectObjects(this.getAllClickableObjects()).forEach((intersection) => {
    if (!intersection.object) {
      console.log('[assert] No object associated with this intersection');
      return;
    }

    var o = intersection.object;

    while (o.parent) {
      if (o.userData && o.userData instanceof $) {
        break;
      }

      o = o.parent;
    }

    if (!o.userData || !o.userData.attr) {
      return;
    }

    results.push({
      uuid: o.name,
      point: intersection.point,
      intersection: intersection,
      position: position,
      direction: direction,
      object: o,
      target: o.userData,
      normal: intersection.face.normal
    });
  });

  return results;
};

// todo - refactor the shit out of this
Client.prototype.onClick = function (e) {
  this.getElementsFromPoint().forEach((object) => {
    // Add button pressed
    object.button = e.button;

    // Emit event
    this.emit('click', object);

    // links
    if (object.object.onClick) {
      object.object.onClick(object);
    }

    // Send event to server
    this.connector.onClick(object);
  });
};

Client.prototype.addMessageInput = function () {
  var self = this;

  this.chatForm = $('<div id=\'message-input\'> <input type=\'text\' placeholder=\'Press enter to start chatting...\' /> </div>').appendTo(this.container);

  var input = this.chatForm.find('input');

  $('body').on('keydown', function (e) {
    if (e.keyCode === 13 && self.controls.enabled && !input.is(':focus')) {
      self.chatForm.find('input').focus();
      self.controls.enabled = false;
    }

    if (e.keyCode === 27) {
      self.releasePointerLock();
    }
  });

  input.on('keydown', function (e) {
    if (e.keyCode === 27) {
      input.text('').blur();
      self.takePointerLock();
    }

    if (e.keyCode === 13) {
      if (input.val() !== '') {
        self.postChatMessage(input.val());
      }

      self.takePointerLock();
      input.val('').blur();

      e.preventDefault();
      e.stopPropagation();
    }
  });

  this.chatMessages = $("<div id='messages' />").hide().appendTo(this.container);
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
      if (!self.options.mouselook) {
        return;
      }

      if (!self.controls.enabled) {
        self.takePointerLock();
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
    this.takePointerLock();
  } else {
    this.releasePointerLock();
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
    if (!self.options.mouselook) {
      return;
    }

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

  this.world.defaultContactMaterial.friction = 0.0;

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
  this.reticule = $('<div />').addClass('aiming-point').hide().appendTo(this.container);
};

Client.prototype.addControls = function () {
  var self = this;

  this.controls = new PointerLockControls(this.camera, this, environment.isMobile(), this.supportsPointerLock());
  this.controls.enabled = false;

  this.controls.on('gamepad-detected', () => {
    this.controls.enabled = true;
    this.hideInstructions();
    // this.consoleLog('Detected gamepad ' + this.controls.gamepad.getName());
  });

  this.addReticule();
};

Client.prototype.removeControls = function () {
  delete this.controls;
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

    this.controls.update(timeStep);
    this.trigger('controls:update', [this.controls]);
  }

  this.lastTime = now;
};

Client.prototype.tick = function () {
  this.emit('update');

  if (this.connector) {
    if ((this.effect instanceof Effects.Vanilla) && (this.connector.isPortalSceneReady())) {
      var portal = this.connector.portal;
      this.effect = new Effects.Portal(this, this.renderer, portal, portal.scene);
    }

    if ((this.effect instanceof Effects.Portal) && (!this.connector.isPortalOpen())) {
      this.effect = new Effects.Vanilla(this, this.renderer);
    }

    this.connector.update(this.getPlayerObject());
  }

  if (!this.stopped && this.scene) {
    //this.stats('frame').start();
    this.stats('FPS').frame();
    this.stats().update();

    if (Utilities.isMobile()) {
      this.vreffect.render(this.scene, this.camera);
    } else if (this.hmd) {
      this.vreffect.render(this.scene, this.camera);
    } else {
      this.effect.render(this.scene, this.camera);
    }

    //this.stats('frame').end();

    this.tickPhysics();
  }

  // Positional audio
  this.voice.setPositionAndOrientation(this.getPlayerObject());

  if (environment.isLowPowerMode()) {
    setTimeout(this.tick.bind(this), 1000 / 12);
  } else {
    window.requestAnimationFrame(this.tick.bind(this));
  }
};

module.exports = Client;
