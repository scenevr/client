'use strict';

var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };


var Utils = require("./utils"),
  URI = require("uri-js"),
  environment = require("./environment"),
  StyleMap = require("./style_map"),
  TWEEN = require("tween.js"),
  EventEmitter = require('wolfy87-eventemitter'),
  Billboard = require("./elements/billboard"),
  Box = require("./elements/box"),
  Sphere = require("./elements/sphere"),
  Skybox = require("./elements/skybox"),
  Fog = require("./elements/fog"),
  Utils = require("./utils"),
  Plane = require("./elements/plane"),
  Player = require("./elements/player"),
  Model = require("./elements/model"),
  Element = require("./elements/element");

// Constants
var PLAYER_MAX_HEAD_ANGLE = Math.PI / 4,
  PLAYER_MIN_HEAD_ANGLE = -Math.PI / 4;

var X_AXIS = new THREE.Vector3(1,0,0),
  Y_AXIS = new THREE.Vector3(0,1,0),
  Z_AXIS = new THREE.Vector3(0,0,1);

var Connector = (function(_super) {
  __extends(Connector, _super);

  function Connector(client, scene, physicsWorld, uri, isPortal, referrer) {
    this.messageQueue = [];

    this.client = client;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.uri = uri;

    this.onMessage = __bind(this.onMessage, this);
    this.tick = __bind(this.tick, this);
    this.reconnect = __bind(this.reconnect, this);

    this.isPortal = isPortal || false;
    this.referrer = referrer || null;
    this.protocol = "scenevr";

    this.uuid = null;

    this.spawned = false;
    this.manager = new THREE.LoadingManager();
    this.spawnPosition = null;
    this.spawnRotation = new THREE.Euler(0, 0, 0);
    this.addLights();
    this.addFloor();

    if(this.client.authentication.hasCompleted()){
      this.onAuthenticationReady();
    }else{
      this.client.authentication.on('ready', this.onAuthenticationReady.bind(this));
    }
  }

  Connector.prototype.destroy = function(){
    clearInterval(this.interval);

    this.disconnect();
    this.unpublishOpentok();

    if(this.session){
      var self = this;
  
      // OpenTok needs some time to unpublish before we can destroy it.
      setTimeout(function(){
        self.session.disconnect();
        delete self.session;
      }, 1500);
    }

    delete this.physicsWorld;
    delete this.scene;
    delete this.client;
  }

  Connector.prototype.onAuthenticationReady = function(){
    if(this.client.authentication.isLoggedIn()){
      this.authenticate();
    }else{
      this.announceAnonymous();
    }
  }
  
  Connector.prototype.authenticate = function(){
    var self = this;

    this.client.authentication.getTokenFor(this.uri, function(ok, token){
      if(!ok){
        console.error("Unable to get token");
      }else{
        console.log("Authenticating....");
        self.sendMessage($("<event />").attr("name", "authenticate").attr("token", token));
      }
    });
  }

  Connector.prototype.announceAnonymous = function(){
    var self = this;
    self.sendMessage($("<event />").attr("name", "authenticate").attr("anonymous", true));
  }

  Connector.prototype.initializeOpentok = function(role, apiKey, sessionId, token) {
    var self = this,
      div = document.createElement("div");

    div.style.display = "none";
    document.body.appendChild(div);
    
    this.opentokSettings = {
      role : role,
      apiKey : apiKey,
      sessionId : sessionId,
      token : token
    };

    this.session = OT.initSession(apiKey, sessionId);
    this.session.on("streamCreated", function(event) {
      console.log("Someone is speaking...");
      self.subscriber = self.session.subscribe(event.stream, div);
      self.subscriber.setStyle({
        audioLevelDisplayMode : 'off',
        buttonDisplayMode : 'off',
        nameDisplayMode : 'off',
        videoDisabledDisplayMode : 'off'
      });
    });

    this.session.connect(token, function(error) {
      console.log("Listening in...");
    });
  };

  Connector.prototype.startTalking = function() {
    if(!this.opentokSettings){
      console.log("This server doesn't appear to support voice chat");
      return;
    }

    if(this.opentokSettings.role === 'subscriber'){
      this.client.addChatMessage(null, "You must log in to be able to speak");
      return;
    }

    var apiKey = this.opentokSettings.apiKey,
      div;
    
    if (!this.publisher) {
      div = document.createElement("div");
      div.style.display = "none";
      document.body.appendChild(div);

      this.publisher = OT.initPublisher(apiKey, div, {
        videoSource: null,
        publishVideo: false,
        publishAudio: true,
        mirror: false
      });

      this.publisher.setStyle({
        audioLevelDisplayMode : 'off',
        buttonDisplayMode : 'off',
        nameDisplayMode : 'off'
      });

      this.publisherIcon = $("<img src='/images/microphone-icon.png' />").addClass('microphone-icon').appendTo('body');
      this.session.publish(this.publisher);
      this.publisher.publishAudio(false);
      this.publisherIcon.hide();

      this.unpublishTimeout = setTimeout(this.unpublishOpentok.bind(this), environment.unpublishTimeout());
      this.muted = true;

      this.client.exitPointerLock();
    }

    if(this.muted){
      this.publisher.publishAudio(true);
      this.publisherIcon.show();

      console.log("publishing...");

      clearTimeout(this.unpublishTimeout);
      this.muted = false;
    }
};

  Connector.prototype.stopTalking = function() {
    var self = this;

    if (this.publisher && !this.muted) {
      this.publisher.publishAudio(false);
      this.publisherIcon.hide();

      console.log("muting...");
      
      // Remove the publisher after 10 seconds
      this.unpublishTimeout = setTimeout(this.unpublishOpentok.bind(this), environment.unpublishTimeout());
      this.muted = true;
    }
  };

  Connector.prototype.unpublishOpentok = function(){
    console.log("Unpublishing...");

    clearTimeout(this.unpublishTimeout);

    this.session.unpublish(this.publisher);
    this.publisher = null;
  };

  Connector.prototype.addFloor = function() {
    var floorGeometry, floorMaterial, floorTexture, groundBody, groundShape;
    floorTexture = new THREE.ImageUtils.loadTexture('/images/grid.png');
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(1000, 1000);
    floorMaterial = new THREE.MeshBasicMaterial({
      fog: true,
      map: floorTexture
    });
    floorGeometry = new THREE.PlaneBufferGeometry(1000, 1000, 1, 1);
    this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.floor.position.y = 0;
    this.floor.rotation.x = -Math.PI / 2;
    this.scene.add(this.floor);
    groundBody = new CANNON.Body({
      mass: 0
    });
    groundShape = new CANNON.Plane();
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    return this.physicsWorld.add(groundBody);
  };

  // Fixme - make proper lights, not hardcoded ones.
  Connector.prototype.addLights = function() {
    var ambientLight, dirLight;
    
    dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(1, 0.75, -0.5);
    this.scene.add(dirLight);
    
    dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(1, 0.75, 0.5);
    this.scene.add(dirLight);

    ambientLight = new THREE.AmbientLight(0x101010);
    this.scene.add(ambientLight);
  };

  Connector.prototype.isPortalOpen = function() {
    return !!this.portal;
  };

  Connector.prototype.loadPortal = function(el, obj) {
    if (this.isPortal) {
      console.error("Portal tried to #loadPortal");
      return;
    }

    var destinationUri = URI.resolve(this.uri, el.attr('href'));

    this.portal = {};
    this.portal.el = el;
    this.portal.obj = obj;
    this.portal.scene = new THREE.Scene;
    this.portal.world = new CANNON.World;
    this.portal.connector = new Connector(this.client, this.portal.scene, this.portal.world, destinationUri, true, this.uri);
    this.portal.connector.connect();
    if (el.attr("backlink") === "true") {
      this.portal.connector.isPreviousPortal = true;
    }
    return this.stencilScene = new THREE.Scene;
  };

  Connector.prototype.closePortal = function() {
    this.scene.remove(this.portal.obj);
    this.portal.connector.disconnect();
    delete this.portal.scene;
    delete this.portal.world;

    this.portal.connector.destroy();
    delete this.portal.connector;

    delete this.portal;
    delete this.stencilScene;
  };

  Connector.prototype.createPortal = function(el, obj) {
    var glow, glowGeometry, glowMaterial, glowTexture, newPosition, portal, portalClone, portalGeometry, portalMaterial;
    this.loadPortal(el, obj);
    while (obj.children[0]) {
      obj.remove(obj.children[0]);
    }
    glowTexture = new THREE.ImageUtils.loadTexture('/images/portal.png');
    glowTexture.wrapS = glowTexture.wrapT = THREE.RepeatWrapping;
    glowTexture.repeat.set(1, 1);
    glowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    glowGeometry = new THREE.PlaneBufferGeometry(2, 2, 1, 1);
    glow = new THREE.Mesh(glowGeometry, glowMaterial);
    portalMaterial = new THREE.MeshBasicMaterial({
      color: '#000000',
      side: THREE.DoubleSide
    });
    portalGeometry = new THREE.CircleGeometry(1 * 0.75, 40);
    portal = new THREE.Mesh(portalGeometry, portalMaterial);
    portal.position.z = 0.001;
    obj.add(glow);
    obj.add(portal);
    newPosition = el.attr("position") && Utils.parseVector(el.attr("position"));
    portalClone = portal.clone();
    portalClone.position.copy(newPosition);
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

  Connector.prototype.setPosition = function(v) {
    this.client.playerBody.position.copy(v);
    this.client.playerBody.position.y += 1.5;
    this.client.playerBody.velocity.set(0, 0, 0);
    this.client.controls.getObject().position.copy(this.client.playerBody.position);
    return this.client.controls.getObject().rotation.y = 0;
  };

  Connector.prototype.respawn = function(reason) {
    if (!this.spawned) {
      console.error("Tried to respawn before spawning");
      return;
    }
    this.setPosition(this.spawnPosition);
    if (reason) {
      return this.client.addChatMessage(null, "You have been respawned because " + reason);
    } else {
      return this.client.addChatMessage(null, "You have been respawned");
    }
  };

  Connector.prototype.hasSpawned = function() {
    return this.spawned === true;
  };

  Connector.prototype.isConnected = function() {
    return this.ws && this.ws.readyState === 1;
  };

  Connector.prototype.disconnect = function() {
    this.ws.onopen = null;
    this.ws.onclose = null;
    this.ws.onmessage = null;
    this.ws.close();
    delete this.ws;
  };

  Connector.prototype.reconnect = function() {
    this.connect();
  };

  Connector.prototype.restartConnection = function() {
    this.disconnect();
    this.trigger('restarting');
    if (this.client) {
      this.client.removeReflectedObjects();
    }
    clearInterval(this.interval);
    setTimeout(this.reconnect, 500);
  };

  Connector.prototype.connect = function() {
    var components = URI.parse(this.uri);

    if (!components.host || !components.path.match(/^\//)) {
      throw "Invalid uri string " + this.uri;
    }

    this.ws = new WebSocket("ws://" + components.host + ":" + (components.port || 80) + components.path, this.protocol);
    this.ws.binaryType = 'arraybuffer';

    var self = this;

    this.ws.onopen = function(){
      if (self.client) {
        self.interval = setInterval(self.tick, 1000 / 5);
      }

      self.trigger('connected');

      self.messageQueue.forEach(function(message){
        self.sendMessage(message);
      })
    };

    this.ws.onclose = function(){
      clearInterval(self.interval);
      self.trigger('disconnected');
    };

    this.ws.onmessage = function(e){
      self.onMessage(e);
    };
  };

  Connector.prototype.sendMessage = function(el) {
    var xml;

    if (this.isConnected()) {
      xml = "<packet>" + $("<packet />").append(el).html() + "</packet>";
      this.ws.send(xml);
    }else{
      this.messageQueue.push(el);
    }
  };

  // These events will be ignored if you don't have modify permission
  Connector.prototype.createElement = function(el){
    this.sendMessage(
      $("<event />").attr("name", "create").append(el)
    );
  }

  Connector.prototype.updateElement = function(el){
    this.sendMessage(
      $("<event />").attr("name", "update").attr("uuid", el.attr("uuid")).append(el)
    );
  }

  Connector.prototype.removeElement = function(el){
    this.sendMessage(
      $("<event />").attr("name", "remove").attr("uuid", el.attr("uuid"))
    );
  }

  Connector.prototype.sendChat = function(message) {
    this.sendMessage($("<event />").attr("name", "chat").attr("message", message.slice(0, 200)));
  };

  Connector.prototype.onCollide = function(e) {
    this.sendMessage($("<event />").attr("name", "collide").attr("uuid", e.uuid).attr("normal", e.normal.toArray().join(" ")));
  };

  Connector.prototype.onClick = function(e) {
    this.sendMessage($("<event />").attr("name", "click").attr("uuid", e.uuid).attr("point", e.point.toArray().join(" ")));
  };

  Connector.prototype.tick = function() {
    if (this.spawned && this.isConnected()) {
      var position = new THREE.Vector3(0, -0.75, 0).add(this.client.getPlayerObject().position),
        rotation = this.client.getRotation();

      return this.sendMessage(
        $("<player />").
          attr("position", position.toArray().join(" ")).
          attr("rotation", rotation.toArray().join(" "))
      );
    }
  };

  Connector.prototype.getAssetHost = function() {
    var components;
    components = URI.parse(this.uri);
    return "//" + components.host + ":" + (components.port || 80);
  };

  Connector.prototype.createPlayer = function(el) {
    var bodyMaterial = new THREE.MeshPhongMaterial({
      color: '#999999'
    });

    var faceTexture = new THREE.ImageUtils.loadTexture('/images/face.png');
    var headMaterial = new THREE.MeshLambertMaterial({
      color: '#ffffaa',
      map : faceTexture
    });

    var geometry1 = new THREE.CylinderGeometry(0.02, 0.5, 1.3, 10),
      body = new THREE.Mesh(geometry1, bodyMaterial);
  
    var geometry2 = new THREE.SphereGeometry(0.3, 10, 10),
      head = new THREE.Mesh(geometry2, headMaterial);
    head.position.y = 0.6;
    head.rotation.y = Math.PI / 2;

    var obj = new THREE.Object3D;
    obj.add(head);
    obj.add(body);

    if(el.attr('name')){
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

  Connector.prototype.createLink = function(el) {
    var color, geometry, geometry2, material, material2, obj, styles;
    obj = new THREE.Object3D;
    styles = new StyleMap(el.attr("style"));
    color = styles.color || "#ff7700";
    geometry2 = new THREE.SphereGeometry(0.25, 16, 16);
    material2 = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      transparent: true,
      opacity: 0.5
    });
    obj.add(new THREE.Mesh(geometry2, material2));
    geometry = new THREE.SphereGeometry(0.12, 16, 16);
    material = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color
    });
    obj.add(new THREE.Mesh(geometry, material));
    obj.onClick = (function(self) {
      return function() {
        if (self.portal && self.portal.obj === obj) {
          return self.closePortal();
        } else if (self.portal) {
          self.closePortal();
          return self.createPortal(el, obj);
        } else {
          return self.createPortal(el, obj);
        }
      };
    })(this);
    obj.body = null;
    return obj;
  };

  Connector.prototype.createAudio = function(el) {
    var obj;
    obj = new THREE.Object3D;
    //obj.position = new THREE.Vector3(0, 0, 0);
    return obj;
  };

  Connector.prototype.getUrlFromStyle = function(value) {
    var e;
    try {
      return value.match(/\((.+?)\)/)[1];
    } catch (_error) {
      e = _error;
      return null;
    }
  };

  Connector.prototype.addElement = function(el) {
    var newPosition, newQuaternion, obj, position, rotation, uuid;

    uuid = el.attr('uuid');
    newPosition = el.attr("position") && Utils.parseVector(el.attr("position"));
    newQuaternion = el.attr("rotation") && new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr("rotation")));

    if (el.is("spawn")) {
      obj = new THREE.Object3D();
      if (!this.spawned) {
        this.spawnPosition = newPosition;
        if (this.isPortal && this.isPreviousPortal) {

        } else if (this.isPortal) {
          rotation = this.spawnRotation.clone();
          rotation.y += 3.141;
          position = this.spawnPosition.clone();
          position.add(new THREE.Vector3(0, 1.28, 0));
          this.addElement($("<link />").attr("position", position.toArray().join(' ')).attr("rotation", [rotation.x, rotation.y, rotation.z].join(' ')).attr("backlink", true).attr("href", this.referrer).attr("style", "color : #0033ff"));
        } else {
          this.setPosition(newPosition);
        }
        this.spawned = true;
      }
    } else if (el.is("billboard")) {
      obj = Billboard.create(this, el);
    } else if (el.is("box")) {
      obj = Box.create(this, el);
    } else if (el.is("sphere")) {
      obj = Sphere.create(this, el);
    } else if (el.is("plane")) {
      obj = Plane.create(this, el);
    } else if (el.is("skybox")) {
      obj = Skybox.create(this, el);
    } else if (el.is("fog")) {
      Fog.create(this, el);
      return;
    } else if (el.is("model")) {
      obj = Model.create(this, el);
    } else if (el.is("link")) {
      obj = this.createLink(el);
    } else if (el.is("audio")) {
      obj = this.createAudio(el);
    } else if (el.is("player")) {
      if (uuid === this.uuid) {
        return;
      }
      if (!newPosition) {
        return;
      }
      obj = this.createPlayer(el);
    } else {
      console.log("Unknown element... \n " + el[0].outerHTML);
      return;
    }

    obj.name = uuid;
    obj.userData = el;

    if (obj.body) {
      this.physicsWorld.add(obj.body);
      obj.body.uuid = uuid;
    }

    if (!el.is("skybox,fog") && newPosition) {
      obj.position.copy(newPosition);
      if (obj.body) {
        obj.body.position.copy(newPosition);
      }
    }

    if (!el.is("skybox,fog") && newQuaternion) {
      obj.quaternion.copy(newQuaternion);
      if (obj.body) {
        obj.body.quaternion.copy(newQuaternion);
      }
    }

    if (el.is("skybox")) {
      obj.castShadow = false;
    } else {
      obj.castShadow = true;
    }

    this.scene.add(obj);

    if (el.attr("style")) {
      var styles = new StyleMap(el.attr("style"));
      
      if (styles["visibility"] === "hidden") {
        obj.visible = false;
      } else {
        obj.visible = true;
      }

      if (el.is("sphere,box,plane") && styles.color) {
        obj.material.setValues({
          color: styles.color,
          ambient: styles.color
        });
      }

      if (el.is("sphere,box,plane") && styles.textureMap) {
        var url = "//" + this.getAssetHost() + this.getUrlFromStyle(styles.textureMap);
        THREE.ImageUtils.crossOrigin = true;

        var texture = new THREE.ImageUtils.loadTexture(url);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

        var repeatX = 1,
          repeatY = 1;

        if(styles.textureRepeat){
          repeatX = parseFloat(styles.textureRepeat.split(" ")[0]);
          repeatY = parseFloat(styles.textureRepeat.split(" ")[1]);
        }

        if(styles.textureRepeatX){
          repeatX = parseFloat(styles.textureRepeatX);
        }
        if(styles.textureRepeatY){
          repeatY = parseFloat(styles.textureRepeatY);
        }

        texture.repeat.set(repeatX, repeatY);

        obj.material.setValues({ map: texture });
      }
    }

    return obj;
  };

  Connector.prototype.processMessage = function(el){
    if (el.is("event")) {
      var name = el.attr("name");

      if (name === "ready") {
        this.uuid = el.attr("uuid");
      } else if (name === "restart") {
        console.log("Got restart message");
        this.restartConnection();
      } else if (name === 'chat') {
        this.client.addChatMessage({
          name: el.attr('from')
        }, el.attr('message'));
      } else if (name === 'respawn') {
        this.respawn(el.attr('reason'));
      } else if (name === 'opentok') {
        if(!environment.isMobile()){
          this.initializeOpentok(
            el.attr('role'), el.attr('apikey'), el.attr('session'), el.attr('token')
          );
        }
      } else {
        console.log("Unrecognized event " + (el.attr('name')));
      }

      return;
    }

    var uuid = el.attr('uuid');

    if(!uuid){
      console.error("No UUID in:\n" + el[0].outerHTML);
      return;
    }

    if (el.is("dead")) {
      var obj;
      
      if (obj = this.scene.getObjectByName(uuid)) {
        if (obj.body) {
          this.physicsWorld.remove(obj.body);
        }
        this.scene.remove(obj);
      }

      return;
    }
    
    var obj = this.scene.getObjectByName(uuid);

    // The element has changed more than just position / rotation, destroy it
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
      if(obj && obj.body){
        this.physicsWorld.add(obj.body);
      }

      // Keep track of the creation element
      if(obj){
        obj.el = el[0];
      }

      return;
    }

    var position = el.attr("position") && Utils.parseVector(el.attr("position")),
      rotation = el.attr("rotation") && new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr("rotation")));

    // We don't tween spawn
    if (el.is("spawn")) {
      obj.position.copy(position);
      return;
    }

    // If we've got to here, only the position or rotation attributes changed, so tween...
    if ((position) && (el.is("box,player,billboard,model,link"))) {
      var start = obj.position.clone();

      if (!start.equals(position)) {
        var tween = new TWEEN.Tween(start);

        tween.to(position, 200).onUpdate(function() {
          obj.position.set(this.x, this.y, this.z);

          if (obj.body) {
            obj.body.position.set(this.x, this.y, this.z);
          }
        }).
          easing(TWEEN.Easing.Linear.None).
          start();
      }
    }

    // Tween anything but the player
    if ((rotation) && (el.is("box,billboard,model,link"))) {
      var start = obj.quaternion.clone();

      if (!start.equals(rotation)) {
        var tween = new TWEEN.Tween({ i : 0.0 });

        tween.to({ i : 1.0}, 200).onUpdate(function() {
          obj.quaternion.copy(start).slerp(rotation, this.i);

          if (obj.body) {
            obj.body.quaternion.copy(obj.quaternion);
          }
        }).
          easing(TWEEN.Easing.Linear.None).
          start();
      }
    }

    if ((rotation) && (el.is("player"))) {
      // Player rotation is different because the head / body are decoupled
      var euler = Utils.parseEuler(el.attr("rotation")),
        bodyQuaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, euler.y + Math.PI / 2),
        headQuaternion = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, THREE.Math.clamp(euler.x, PLAYER_MIN_HEAD_ANGLE, PLAYER_MAX_HEAD_ANGLE));

      // todo - add rotation around the z axis (for rifters)
      // todo - dont tween if the player hasn't moved...

      var head = obj.children[0],
        startBodyQ = obj.quaternion.clone(),
        startHeadQ = head.quaternion.clone();

      var tween = new TWEEN.Tween({ i : 0.0 });

      tween.to({ i : 1.0}, 200).onUpdate(function() {
        obj.quaternion.copy(startBodyQ).slerp(bodyQuaternion, this.i);
        head.quaternion.copy(startHeadQ).slerp(headQuaternion, this.i);
      }).
        easing(TWEEN.Easing.Linear.None).
        start();
    }
  };

  Connector.prototype.onMessage = function(e) {
    var self = this,
      children = $($.parseXML(e.data).firstChild).children();

    children.each(function(index, el){
      self.processMessage($(el));
    });
  };

  return Connector;

})(EventEmitter);

module.exports = Connector;
