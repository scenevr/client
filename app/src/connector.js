var util = require('util');
var Utils = require('./utils');
var URI = require('uri-js');
var environment = require('./environment');
var StyleMap = require('./style_map');
var TWEEN = require('tween.js');
var CANNON = require('cannon');
var EventEmitter = require('wolfy87-eventemitter');
var Billboard = require('./elements/billboard');
var Audio = require('./elements/audio');
var Box = require('./elements/box');
var Sphere = require('./elements/sphere');
var Skybox = require('./elements/skybox');
var Fog = require('./elements/fog');
var Utils = require('./utils');
var Plane = require('./elements/plane');
var Player = require('./elements/player');
var Model = require('./elements/model');
var Element = require('./elements/element');
var RenderQueue = require('./render_queue');

// For semistandard
var $ = window.jQuery;
var THREE = window.THREE;

// Constants
var PLAYER_MAX_HEAD_ANGLE = Math.PI / 4;
var PLAYER_MIN_HEAD_ANGLE = -Math.PI / 4;

var Y_AXIS = new THREE.Vector3(0, 1, 0);
var Z_AXIS = new THREE.Vector3(0, 0, 1);

function Connector (client, scene, physicsWorld, uri, isPortal, referrer) {
  this.client = client;
  this.scene = scene;
  this.physicsWorld = physicsWorld;
  this.uri = URI.parse(uri);
  this.isPortal = isPortal || false;
  this.referrer = referrer || null;
  this.elementMap = {};
  this.renderQueue = new RenderQueue();

  this.initialize();
}

util.inherits(Connector, EventEmitter);

Connector.prototype.initialize = function () {
  this.messageQueue = [];
  this.uuid = null;
  this.spawned = false;
  this.manager = new THREE.LoadingManager();
  this.spawnPosition = null;
  this.spawnRotation = new THREE.Euler(0, 0, 0);

  if (this.client.authentication.hasCompleted()) {
    this.onAuthenticationReady();
  } else {
    this.client.authentication.on('ready', this.onAuthenticationReady.bind(this));
  }
};

Connector.prototype.destroy = function () {
  var self = this;

  clearInterval(this.interval);

  this.renderQueue.clear();
  this.disconnect();
  this.unpublishOpentok();

  if (this.session) {
    // OpenTok needs some time to unpublish before we can destroy it.
    setTimeout(function () {
      self.session.disconnect();
      delete self.session;
    }, 1000);
  }

  delete this.renderQueue;
  delete this.physicsWorld;
  delete this.scene;
  delete this.client;
};

Connector.prototype.onAuthenticationReady = function () {
  if (this.client.authentication.isLoggedIn()) {
    this.authenticate();
  } else {
    this.announceAnonymous();
  }
};

Connector.prototype.authenticate = function () {
  var self = this;

  this.client.authentication.getTokenFor(this.uri, function (ok, token) {
    if (!ok) {
      console.error('Unable to get token');
    } else {
      console.log('Authenticating....');
      self.sendMessage($('<event />').attr('name', 'authenticate').attr('token', token));
    }
  });
};

Connector.prototype.announceAnonymous = function () {
  var self = this;
  self.sendMessage($('<event />').attr('name', 'authenticate').attr('anonymous', true));
};

Connector.prototype.initializeOpentok = function (role, apiKey, sessionId, token) {
  var self = this;

  var div = document.createElement('div');
  div.style.display = 'none';

  document.body.appendChild(div);

  this.opentokSettings = {
    role: role,
    apiKey: apiKey,
    sessionId: sessionId,
    token: token
  };

  this.session = window.OT.initSession(apiKey, sessionId);

  this.session.on('streamCreated', function (event) {
    console.log('Someone is speaking...');
    self.subscriber = self.session.subscribe(event.stream, div);
    self.subscriber.setStyle({
      audioLevelDisplayMode: 'off',
      buttonDisplayMode: 'off',
      nameDisplayMode: 'off',
      videoDisabledDisplayMode: 'off'
    });
  });

  this.session.connect(token, function (error) {
    if (error) {
      console.error('Could not listen in...');
    }

    console.log('Listening in...');
  });
};

Connector.prototype.startTalking = function () {
  if (!this.opentokSettings) {
    console.log('This server doesn\'t appear to support voice chat');
    return;
  }

  if (this.opentokSettings.role === 'subscriber') {
    this.client.addChatMessage(null, 'You must log in to be able to speak');
    return;
  }

  var apiKey = this.opentokSettings.apiKey;
  var div;

  if (!this.publisher) {
    div = document.createElement('div');
    div.style.display = 'none';
    document.body.appendChild(div);

    this.publisher = window.OT.initPublisher(apiKey, div, {
      videoSource: null,
      publishVideo: false,
      publishAudio: true,
      mirror: false
    });

    this.publisher.setStyle({
      audioLevelDisplayMode: 'off',
      buttonDisplayMode: 'off',
      nameDisplayMode: 'off'
    });

    this.publisherIcon = $('<img src="/images/microphone-icon.png" />').addClass('microphone-icon').appendTo('body');
    this.session.publish(this.publisher);
    this.publisher.publishAudio(false);
    this.publisherIcon.hide();

    this.unpublishTimeout = setTimeout(this.unpublishOpentok.bind(this), environment.unpublishTimeout());
    this.muted = true;

    this.client.exitPointerLock();
  }

  if (this.muted) {
    this.publisher.publishAudio(true);
    this.publisherIcon.show();
    console.log('publishing...');
    clearTimeout(this.unpublishTimeout);
    this.muted = false;
  }
};

Connector.prototype.stopTalking = function () {
  if (this.publisher && !this.muted) {
    this.publisher.publishAudio(false);
    this.publisherIcon.hide();

    console.log('muting...');

    // Remove the publisher after XX seconds
    this.unpublishTimeout = setTimeout(this.unpublishOpentok.bind(this), environment.unpublishTimeout());
    this.muted = true;
  }
};

Connector.prototype.unpublishOpentok = function () {
  console.log('Unpublishing...');

  clearTimeout(this.unpublishTimeout);

  if ((this.session) && (this.publisher)) {
    this.session.unpublish(this.publisher);
  }

  this.publisher = null;
};

Connector.prototype.addFloor = function () {
  var floorTexture = THREE.ImageUtils.loadTexture('/images/grid.png');
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(1000, 1000);

  var floorMaterial = new THREE.MeshBasicMaterial({
    fog: true,
    map: floorTexture
  });

  var floorGeometry = new THREE.PlaneBufferGeometry(1000, 1000, 1, 1);
  var floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = 0;
  floor.rotation.x = -Math.PI / 2;
  this.scene.add(floor);

  var groundBody = new CANNON.Body({
    mass: 0
  });

  var groundShape = new CANNON.Plane();
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

  this.physicsWorld.add(groundBody);
};

Connector.prototype.addLights = function () {
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(1, 0.75, -0.5);
  this.scene.add(dirLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(1, 0.75, 0.5);
  this.scene.add(dirLight);

  var ambientLight = new THREE.AmbientLight(0x101010);
  this.scene.add(ambientLight);
};

Connector.prototype.isPortalOpen = function () {
  return !!this.portal;
};

Connector.prototype.loadPortal = function (el, obj) {
  if (this.isPortal) {
    console.error('Portal tried to #loadPortal');
    return;
  }

  var uri = URI.serialize(this.uri);
  var destinationUri = URI.resolve(uri, el.attr('href'));

  this.portal = {};
  this.portal.el = el;
  this.portal.obj = obj;
  this.portal.scene = new THREE.Scene();
  this.portal.world = new CANNON.World();
  this.portal.connector = new Connector(this.client, this.portal.scene, this.portal.world, destinationUri, true, uri);
  this.portal.connector.connect();

  if (el.attr('backlink') === 'true') {
    this.portal.connector.isPreviousPortal = true;
  }

  this.stencilScene = new THREE.Scene();
};

Connector.prototype.closePortal = function () {
  this.scene.remove(this.portal.obj);
  this.portal.connector.disconnect();
  this.portal.connector.destroy();

  delete this.portal.scene;
  delete this.portal.world;
  delete this.portal.connector;
  delete this.portal;
  delete this.stencilScene;
};

Connector.prototype.createPortal = function (el, obj) {
  this.loadPortal(el, obj);

  while (obj.children[0]) {
    obj.remove(obj.children[0]);
  }

  var glowTexture = THREE.ImageUtils.loadTexture('/images/portal.png');
  glowTexture.wrapS = glowTexture.wrapT = THREE.RepeatWrapping;
  glowTexture.repeat.set(1, 1);

  var glowMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    side: THREE.DoubleSide
  });

  var glowGeometry = new THREE.PlaneBufferGeometry(2, 2, 1, 1);
  var glow = new THREE.Mesh(glowGeometry, glowMaterial);
  var portalMaterial = new THREE.MeshBasicMaterial({
    color: '#000000',
    side: THREE.DoubleSide
  });
  var portalGeometry = new THREE.CircleGeometry(1 * 0.75, 40);

  var portal = new THREE.Mesh(portalGeometry, portalMaterial);
  portal.position.z = 0.001;
  obj.add(glow);
  obj.add(portal);

  var position = el.attr('position') && Utils.parseVector(el.attr('position'));
  var portalClone = portal.clone();

  portalClone.position.copy(position);
  portalClone.position.z += 0.1;
  portalClone.quaternion.copy(obj.quaternion);
  portalClone.visible = true;
  portalClone.updateMatrix();
  portalClone.updateMatrixWorld(true);
  portalClone.matrixAutoUpdate = false;
  portalClone.frustumCulled = false;
  this.stencilScene.add(portalClone);

  return obj;
};

Connector.prototype.setPosition = function (v) {
  this.client.playerBody.position.copy(v);
  this.client.playerBody.position.y += 1.5;
  this.client.playerBody.velocity.set(0, 0, 0);
  this.client.controls.getObject().position.copy(this.client.playerBody.position);
  this.client.controls.getObject().rotation.y = 0;
};

Connector.prototype.respawn = function (reason) {
  if (!this.spawned) {
    console.error('Tried to respawn before spawning');
    return;
  }

  this.setPosition(this.spawnPosition);

  if (reason) {
    this.client.addChatMessage(null, 'You have been respawned because ' + reason);
  } else {
    this.client.addChatMessage(null, 'You have been respawned');
  }
};

Connector.prototype.hasSpawned = function () {
  return this.spawned === true;
};

Connector.prototype.isConnected = function () {
  return this.ws && this.ws.readyState === 1;
};

Connector.prototype.disconnect = function () {
  this.ws.onopen = null;
  this.ws.onclose = null;
  this.ws.onmessage = null;
  this.ws.close();
  delete this.ws;
};

Connector.prototype.reconnect = function () {
  this.connect();
};

Connector.prototype.restartConnection = function () {
  this.disconnect();
  this.trigger('restarting');

  if (this.client) {
    this.client.removeAllObjectsFromScene();
  }

  clearInterval(this.interval);
  setTimeout(this.reconnect.bind(this), 500);
};

Connector.prototype.addViewSourceButton = function () {
  var self = this;

  $('#view-source').remove();
  var div = $('<div id=\'view-source\' />').appendTo('body');
  $('<button />').text('View source').appendTo(div).click(function (e) {
    window.location = 'view-source:http://' + URI.serialize(self.uri);
  });
};

Connector.prototype.connect = function () {
  if (!this.uri.host || !this.uri.path.match(/^\//)) {
    throw new Error('Invalid uri ' + URI.serialize(this.uri));
  }

  // fixme: Make all websockets connections on port 8080, instead of this hack for scenevr.hosting.
  if (this.uri.host.match(/scenevr\.hosting/)) {
    this.uri.port = '8080';
  }

  this.ws = new window.WebSocket('ws://' + this.uri.host + ':' + (this.uri.port || 80) + this.uri.path, 'scenevr');
  this.ws.binaryType = 'arraybuffer';

  var self = this;

  this.ws.onopen = function () {
    if (self.client) {
      self.interval = setInterval(self.tick.bind(self), 1000 / environment.updateHertz());
    }

    self.addViewSourceButton();
    self.trigger('connected');

    self.messageQueue.forEach(function (message) {
      self.sendMessage(message);
    });

    self.addLights();
    self.addFloor();
  };

  this.ws.onclose = function () {
    clearInterval(self.interval);
    self.trigger('disconnected');
  };

  this.ws.onmessage = function (e) {
    self.onMessage(e);
  };
};

Connector.prototype.sendMessage = function (el) {
  var xml;

  if (this.isConnected()) {
    xml = '<packet>' + $('<packet />').append(el).html() + '</packet>';
    this.ws.send(xml);
  } else {
    this.messageQueue.push(el);
  }
};

Connector.prototype.inspectElement = function (el) {
  this.sendMessage(
    $('<event />').attr('name', 'inspect').attr('uuid', el.attr('uuid'))
  );
};

Connector.prototype.sendChat = function (message) {
  this.sendMessage($('<event />').attr('name', 'chat').attr('message', message.slice(0, 200)));
};

Connector.prototype.onCollide = function (e) {
  this.sendMessage($('<event />').attr('name', 'collide').attr('uuid', e.uuid).attr('normal', e.normal.toArray().join(' ')));
};

Connector.prototype.onClick = function (e) {
  this.sendMessage($('<event />').attr('name', 'click').attr('uuid', e.uuid).attr('point', e.point.toArray().join(' ')));
};

Connector.prototype.tick = function () {
  if (this.spawned && this.isConnected()) {
    var position = new THREE.Vector3(0, -0.75, 0).add(this.client.getPlayerObject().position);
    var rotation = this.client.getRotation();

    this.sendMessage(
      $('<player />').
        attr('position', position.toArray().join(' ')).
        attr('rotation', rotation.toArray().join(' '))
    );
  }
};

Connector.prototype.getAssetHost = function () {
  return 'http://' + this.uri.host + ':' + (this.uri.port || 80);
};

Connector.prototype.createPlayer = function (el) {
  var bodyMaterial = new THREE.MeshPhongMaterial({
    color: '#999999'
  });

  var faceTexture = THREE.ImageUtils.loadTexture('/images/face.png');
  var headMaterial = new THREE.MeshLambertMaterial({
    color: '#ffffaa',
    map: faceTexture
  });

  var geometry1 = new THREE.CylinderGeometry(0.02, 0.5, 1.3, 10);
  var body = new THREE.Mesh(geometry1, bodyMaterial);

  var geometry2 = new THREE.SphereGeometry(0.3, 10, 10);
  var head = new THREE.Mesh(geometry2, headMaterial);
  head.position.y = 0.6;
  head.rotation.y = Math.PI / 2;

  var obj = new THREE.Object3D();
  obj.add(head);
  obj.add(body);

  if (el.attr('name')) {
    obj.add(Player.createLabel(el));
  }

  // loader = new THREE.OBJLoader(this.manager);
  // loader.load("//" + this.getAssetHost() + "/models/hardhat.obj", (function(self) {
  //   return function(object) {
  //     object.traverse(function(child) {
  //       material = new THREE.MeshPhongMaterial({
  //         color: '#FFCC00'
  //       });
  //       if (child instanceof THREE.Mesh) {
  //         return child.material = material;
  //       }
  //     });
  //     object.scale.set(0.3, 0.3, 0.3);
  //     object.position.y += 0.7;
  //     return obj.add(object);
  //   };
  // })(this));

  return obj;
};

Connector.prototype.createLink = function (el) {
  var self = this;
  var obj = new THREE.Object3D();
  var styles = new StyleMap(el.attr('style'));
  var color = styles.color || '#ff7700';

  var outerSphere = new THREE.SphereGeometry(0.25, 16, 16);
  var outerMaterial = new THREE.MeshPhongMaterial({
    color: color,
    emissive: color,
    transparent: true,
    opacity: 0.5
  });
  obj.add(new THREE.Mesh(outerSphere, outerMaterial));

  var innerSphere = new THREE.SphereGeometry(0.12, 16, 16);
  var innerMaterial = new THREE.MeshPhongMaterial({
    color: color,
    emissive: color
  });
  obj.add(new THREE.Mesh(innerSphere, innerMaterial));

  obj.onClick = function () {
    if (self.portal && self.portal.obj === obj) {
      self.closePortal();
    } else if (self.portal) {
      self.closePortal();
      self.createPortal(el, obj);
    } else {
      self.createPortal(el, obj);
    }
  };

  obj.body = null;

  return obj;
};

Connector.prototype.getUrlFromStyle = function (value) {
  var matches = value.match(/\((.+?)\)/);

  if (matches) {
    return matches[1];
  } else {
    return null;
  }
};

Connector.prototype.addElement = function (el) {
  var uuid = el.attr('uuid');
  var position = el.attr('position') && Utils.parseVector(el.attr('position'));
  var quaternion = el.attr('rotation') && new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr('rotation')));
  var obj;
  var element;

  if (el.is('spawn')) {
    obj = new THREE.Object3D();
    if (!this.spawned) {
      this.spawnPosition = position;
      if (this.isPortal && this.isPreviousPortal) {

      } else if (this.isPortal) {
        var rotation = this.spawnRotation.clone();
        rotation.y += 3.141;

        var p = this.spawnPosition.clone();
        p.add(new THREE.Vector3(0, 1.28, 0));

        this.addElement($('<link />').attr('position', p.toArray().join(' '))
          .attr('rotation', [rotation.x, rotation.y, rotation.z].join(' '))
          .attr('backlink', true)
          .attr('href', this.referrer)
          .attr('style', 'color : #0033ff'));
      } else {
        this.setPosition(position);
      }
      this.spawned = true;
    }
  } else if (el.is('audio')) {
    element = new Audio(this, el);
    obj = element.create();
  } else if (el.is('billboard')) {
    obj = Billboard.create(this, el);
  } else if (el.is('box')) {
    obj = Box.create(this, el);
  } else if (el.is('sphere')) {
    obj = Sphere.create(this, el);
  } else if (el.is('plane')) {
    obj = Plane.create(this, el);
  } else if (el.is('skybox')) {
    obj = Skybox.create(this, el);
  } else if (el.is('fog')) {
    Fog.create(this, el);
    return;
  } else if (el.is('model')) {
    obj = Model.create(this, el);
  } else if (el.is('link')) {
    obj = this.createLink(el);
  } else if (el.is('player')) {
    if (uuid === this.uuid) {
      return;
    }
    if (!position) {
      // query: umm - why would a player object not have a position? :/
      return;
    }
    obj = this.createPlayer(el);
  } else {
    console.log('Unknown element... \n ' + el[0].outerHTML);
    return;
  }

  obj.name = uuid;
  obj.userData = el;

  if (obj.body) {
    this.physicsWorld.add(obj.body);
    obj.body.uuid = uuid;
  }

  if (!el.is('skybox,fog') && position) {
    obj.position.copy(position);

    if (obj.body) {
      obj.body.position.copy(position);
    }
  }

  if (!el.is('skybox,fog') && quaternion) {
    obj.quaternion.copy(quaternion);

    if (obj.body) {
      obj.body.quaternion.copy(quaternion);
    }
  }

  this.scene.add(obj);

  if (el.attr('style')) {
    var styles = new StyleMap(el.attr('style'));

    if (styles['visibility'] === 'hidden') {
      obj.visible = false;
    } else {
      obj.visible = true;
    }

    if (el.is('sphere,box,plane') && styles.color) {
      obj.material.setValues({
        color: styles.color,
        ambient: styles.color
      });
    }

    if (el.is('sphere,box,plane') && styles.emissiveColor) {
      obj.material.setValues({
        color: 0x000000,
        emissive: styles.emissiveColor
      });
    }

    if (el.is('sphere,box,plane') && styles.textureMap) {
      var url = this.getAssetHost() + this.getUrlFromStyle(styles.textureMap);
      THREE.ImageUtils.crossOrigin = true;

      var texture = THREE.ImageUtils.loadTexture(url);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

      var repeatX = 1;
      var repeatY = 1;

      if (styles.textureRepeat) {
        var pair = styles.textureRepeat.split(' ');
        repeatX = parseFloat(pair[0]);
        repeatY = parseFloat(pair[1]);
      }

      if (styles.textureRepeatX) {
        repeatX = parseFloat(styles.textureRepeatX);
      }

      if (styles.textureRepeatY) {
        repeatY = parseFloat(styles.textureRepeatY);
      }

      texture.repeat.set(repeatX, repeatY);

      obj.material.setValues({ map: texture, transparent: true });
    }
  }

  if (element) {
    this.elementMap[uuid] = element;
  } else {
    this.elementMap[uuid] = {
      el: el,
      obj: obj
    };
  }

  return obj;
};

Connector.prototype.getByUUID = function (uuid) {
  return this.elementMap[uuid];
};

Connector.prototype.getAudioElements = function () {
  var results = [];
  var key;

  for (key in this.elementMap) {
    if (this.elementMap[key] instanceof Audio) {
      results.push(this.elementMap[key]);
    }
  }

  return results;
};

Connector.prototype.processMessage = function (el) {
  var obj;

  if (el.is('event')) {
    var name = el.attr('name');
    var element;

    if (el.attr('uuid')) {
      element = this.getByUUID(el.attr('uuid'));
    }

    if (name === 'ready') {
      this.uuid = el.attr('uuid');
    } else if (name === 'restart') {
      console.log('Got restart message');
      this.restartConnection();
    } else if (name === 'chat') {
      this.client.addChatMessage({
        name: el.attr('from')
      }, el.attr('message'));
    } else if (name === 'respawn') {
      this.respawn(el.attr('reason'));
    } else if (name === 'opentok') {
      if (!environment.isMobile()) {
        this.initializeOpentok(
          el.attr('role'), el.attr('apikey'), el.attr('session'), el.attr('token')
        );
      }
    } else if (name === 'inspect') {
      this.client.editor.inspectResult(el);
    } else if (name === 'play') {
      if (element) {
        element.play();
      }
    } else if (name === 'stop') {
      if (element) {
        element.stop();
      }
    } else {
      console.log('Unrecognized event ' + (el.attr('name')));
    }

    return;
  }

  var uuid = el.attr('uuid');

  if (!uuid) {
    console.error('Element has no UUID in:\n' + el[0].outerHTML);
    return;
  }

  if (el.is('dead')) {
    obj = this.scene.getObjectByName(uuid);

    if (obj) {
      if (obj.body) {
        this.physicsWorld.remove(obj.body);
      }

      this.scene.remove(obj);

      delete this.elementMap[uuid];
    }

    return;
  }

  obj = this.scene.getObjectByName(uuid);

  var startPosition = null;
  var startQuaternion = null;

  if (obj) {
    startPosition = obj.position.clone();
    startQuaternion = obj.quaternion.clone();
  }

  // The element has changed more than just position / rotation, destroy it, but save the position / rotation
  if (obj && (Element.substantialDifference(obj.el, el[0]))) {
    if (obj.body) {
      this.physicsWorld.remove(obj.body);
    }
    this.scene.remove(obj);

    // todo - refactor this, the control flow isn't obvious
    obj = null;
  }

  if (!obj) {
    obj = this.addElement(el);

    // Not all elements are represented by an Object3D, so they don't return anything from #addElement
    if (obj && obj.body) {
      this.physicsWorld.add(obj.body);
    }

    // Keep track of the creation element
    if (obj) {
      obj.el = el[0];
    }
  }

  if (!obj) {
    return;
  }

  var position = el.attr('position') && Utils.parseVector(el.attr('position'));
  var quaternion = el.attr('rotation') && new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr('rotation')));

  // We don't tween spawn
  if (el.is('spawn')) {
    obj.position.copy(position);
    return;
  }

  // If we've got to here, check if the position / rotation has changed
  if (position && (el.is('box,player,billboard,model,link'))) {
    if (startPosition) {
      obj.position.copy(startPosition);
    } else {
      startPosition = obj.position.clone();
    }

    if (!startPosition.equals(position)) {
      var tweenPosition = new TWEEN.Tween(startPosition);

      tweenPosition.to(position, 1000 / environment.updateHertz()).onUpdate(function () {
        obj.position.set(this.x, this.y, this.z);

        if (obj.body) {
          obj.body.position.set(this.x, this.y, this.z);
        }
      }).easing(TWEEN.Easing.Linear.None).start();
    }
  }

  // Tween anything but the player
  if (startQuaternion && quaternion && (el.is('box,billboard,model,link'))) {
    if (startQuaternion) {
      obj.quaternion.copy(startQuaternion);
    } else {
      startQuaternion = obj.quaternion.clone();
    }

    if (!startQuaternion.equals(quaternion)) {
      var tweenRotation = new TWEEN.Tween({ i: 0.0 });

      tweenRotation.to({ i: 1.0}, 1000 / environment.updateHertz()).onUpdate(function () {
        obj.quaternion.copy(startQuaternion).slerp(quaternion, this.i);

        if (obj.body) {
          obj.body.quaternion.copy(obj.quaternion);
        }
      }).easing(TWEEN.Easing.Linear.None).start();
    }
  }

  if (quaternion && (el.is('player'))) {
    // Player rotation is different because the head / body are decoupled
    var euler = Utils.parseEuler(el.attr('rotation'));
    var bodyQuaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, euler.y + Math.PI / 2);
    var headQuaternion = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, THREE.Math.clamp(euler.x, PLAYER_MIN_HEAD_ANGLE, PLAYER_MAX_HEAD_ANGLE));

    // todo - add rotation around the z axis (for rifters)
    // todo - dont tween if the player hasn't moved...

    var head = obj.children[0];
    var startBodyQ = obj.quaternion.clone();
    var startHeadQ = head.quaternion.clone();

    var tween = new TWEEN.Tween({ i: 0.0 });

    tween.to({ i: 1.0}, 1000 / environment.updateHertz()).onUpdate(function () {
      obj.quaternion.copy(startBodyQ).slerp(bodyQuaternion, this.i);
      head.quaternion.copy(startHeadQ).slerp(headQuaternion, this.i);
    }).easing(TWEEN.Easing.Linear.None).start();
  }
};

Connector.prototype.onMessage = function (e) {
  this.client.stats.connector.begin();

  var self = this;
  var children = $($.parseXML(e.data).firstChild).children();

  children.each(function (index, el) {
    self.processMessage($(el));
  });

  this.client.stats.connector.end();
};

module.exports = Connector;
