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
var Stats = require('stats-js');
var Editor = require('./editor');
var Utilities = require('../vendor/webvr-manager/util');

// sadface
window.THREE = THREE;
window.WebVRConfig = {};

require('../vendor/CopyShader.js');
require('../vendor/EffectComposer.js');
require('../vendor/MaskPass.js');
require('../vendor/RenderPass.js');
require('../vendor/SSAOShader.js');
require('../vendor/ShaderPass.js');
require('../vendor/SkyShader.js');
require('../vendor/vr-controls.js');
require('../vendor/vr-effect.js');
require('webvr-polyfill');

// var WebVRManager = require('../vendor/webvr-manager/webvr-manager');

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
      '</p><p>Arrow keys = Move, SPACE = jump<.p><p>Click the orange globes to open portals.';
  },
  connecting: function (args) {
    return '<div class="connecting"><h1>Connecting</h1><p>SceneVR is connecting to <b>' + args.host + '</b>';
  }
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
  this.createRenderer();
  this.createScene();
  this.addControls();
  // this.addEditor();

  if (Utilities.isMobile()) {
    $('body').addClass('mobile');
    $('html,body').on('touchstart touchmove', function (e) {
      // prevent native touch activity like scrolling
      e.preventDefault();
    });
    $('#stats, #view-source, header').hide()

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

Client.prototype.addEditor = function () {
  this.editor = new Editor(this);
};

Client.prototype.createScene = function () {
  this.setScene(new THREE.Scene());
};

Client.prototype.setScene = function (scene) {
  this.scene = scene;

  if (environment.ambientOcclusionEnabled()) {
    var width = this.container.width();
    var height = this.container.height();

    this.composer = new THREE.EffectComposer(this.renderer);
    this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));

    this.depthTarget = new THREE.WebGLRenderTarget(width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });

    var effect = new THREE.ShaderPass(THREE.SSAOShader);
    effect.uniforms['tDepth'].value = this.depthTarget;
    effect.uniforms['size'].value.set(width, height);
    effect.uniforms['cameraNear'].value = this.camera.near;
    effect.uniforms['cameraFar'].value = this.camera.far;
    effect.renderToScreen = true;

    this.composer.addPass(effect);
  }
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

Client.prototype.loadScene = function (sceneProxy) {
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
  if (sceneProxy.scene) {
    this.connector = new Connector(this, this.scene, this.world, 'http://localhost/');
    this.connector.directConnect(sceneProxy);
  } else {
    this.connector = new Connector(this, this.scene, this.world, sceneProxy);
    this.connector.connect();
  }

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
  this.stats = {};

  this.stats.rendering = new Stats();
  this.stats.rendering.setMode(0);
  this.stats.rendering.domElement.style.position = 'absolute';
  this.stats.rendering.domElement.style.bottom = '10px';
  this.stats.rendering.domElement.style.zIndex = 110;
  this.stats.rendering.domElement.style.right = '10px';
  this.container.append(this.stats.rendering.domElement);

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
    antialias: environment.antiAliasingEnabled(),
    alpha: false,
    // precision: 'lowp',
    canvas: this.domElement[0],
    preserveDrawingBuffer: true
  });

  if (environment.ambientOcclusionEnabled()) {
    // depth
    var depthShader = THREE.ShaderLib['depthRGBA'];
    var depthUniforms = THREE.UniformsUtils.clone(depthShader.uniforms);

    this.depthMaterial = new THREE.ShaderMaterial({ fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms });
    this.depthMaterial.blending = THREE.NoBlending;

    // postprocessing
    this.composer = new THREE.EffectComposer(this.renderer);
  }

  this.renderer.setSize(width / environment.getDownsampling(), height / environment.getDownsampling());
  this.renderer.setClearColor(0xFFFFFF);
  this.renderer.autoClear = true;
  this.renderer.sortObjects = false;
  this.renderer.shadowMapEnabled = true;
  this.renderer.shadowMapType = THREE.PCFSoftShadowMap;

  this.effect = new Effects.Vanilla(this, this.renderer);

  window.addEventListener('resize', this.onWindowResize.bind(this), false);
};

Client.prototype.onWindowResize = function () {
  var self = this;
  var width = this.container.width();
  var height = this.container.height();

  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(width / environment.getDownsampling(), height / environment.getDownsampling());

  this.domElement.css({
    width: width,
    height: height
  });

  this.centerOverlay();
};

Client.prototype.enableControls = function () {
  this.controls.enabled = true;
  this.hideInstructions();

  if (!Utilities.isMobile()) {
    this.reticule.show();
  }
};

Client.prototype.disableControls = function () {
  this.controls.enabled = false;
  this.reticule.hide();
  this.exitPointerLock();
};

Client.prototype.getDropPosition = function () {
  var player = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());

  return player.clone().add(direction.multiplyScalar(2));
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
  var self = this;
  var position = this.controls.getObject().position;
  var direction = this.controls.getDirection(new THREE.Vector3());

  this.raycaster.set(position, direction);
  this.raycaster.far = 5.0;

  // fixme - the search for the userData node is pretty ganky
  this.raycaster.intersectObjects(this.getAllClickableObjects()).forEach(function (intersection) {
    var iEvent = {
      position: position,
      direction: direction,
      intersection: intersection,
      target: intersection.object.userData
    }

    if (iEvent.target && iEvent.target.attr && iEvent.target.attr('uuid')) {
      self.emit('click', iEvent);
    }

    if (intersection.object && intersection.object.parent && intersection.object.parent.userData.is && intersection.object.parent.userData.is('link')) {
      intersection.object.parent.onClick(iEvent);
    }

    if (intersection.object && intersection.object.onClick) {
      intersection.object.onClick(iEvent);
    }

    var obj = intersection.object;

    while (obj.parent) {
      if (obj.userData instanceof $) {
        self.connector.onClick({
          uuid: obj.name,
          point: intersection.point,
          direction: direction,
          normal: intersection.face.normal,
          button: e.button,
          selectedColor: this.editor && this.editor.selectedIndex
        });

        return;
      }
      obj = obj.parent;
    }
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

  this.world.defaultContactMaterial.friction = 0.0

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

    this.controls.update(timeStep);
    this.trigger('controls:update', [this.controls]);
  }

  this.lastTime = now;
};

Client.prototype.tick = function () {
  if (this.connector) {
    if ((this.effect instanceof Effects.Vanilla) && (this.connector.isPortalSceneReady())) {
      var portal = this.connector.portal;
      this.effect = new Effects.Portal(this, this.renderer, portal, portal.scene);
    }

    if ((this.effect instanceof Effects.Portal) && (!this.connector.isPortalOpen())) {
      this.effect = new Effects.Vanilla(this, this.renderer);
    }
  }

  if (Utilities.isMobile()) {
    this.effect = this.vreffect;
  }

  if (!this.stopped && this.scene) {
    this.stats.rendering.begin();

    this.effect.render(this.scene, this.camera);

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
