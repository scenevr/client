var THREE = window.THREE;

var KEY = 'PREFERENCES';

function Preferences (client) {
  this.client = client;
  this.loadState();
}

Preferences.prototype.loadState = function () {
  this.setDefaults();

  if (window.localStorage[KEY]) {
    try {
      var key;
      var obj = JSON.parse(window.localStorage[KEY]);

      for (key in obj) {
        this.state[key] = obj[key];
      }
    } catch (err) {
      // ..
    }
  } else {
  }
};

Preferences.prototype.saveState = function () {
  window.localStorage[KEY] = JSON.stringify(this.state);
};

Preferences.prototype.resetState = function () {
  this.setDefaults();
  this.saveState();
};

Preferences.prototype.setDefaults = function () {
  this.state = {
    downSampling: 1,
    graphicsAntialiasing: false,
    audioVolume: 8,
    audioVoiceChat: 8
  };
};

Preferences.prototype.getState = function () {
  return this.state;
};

Preferences.prototype.reinitializeGraphics = function () {
  this.client.reinitializeGraphics();
};

Preferences.prototype.createGui = function () {
  var guiDefaultWidth = 240;
  var self = this;

  this.gui = new THREE.SimpleDatGui({
    scene: this.client.scene,
    client: this.client,
    camera: this.client.camera,
    renderer: this.client.renderer,
    width: guiDefaultWidth,
    scale: 0.01,
    position: new THREE.Vector3(-0.5, 1.5, 5)
  });

  var folder1 = this.gui.addFolder('Graphics');

  folder1.add(this.state, 'graphicsAntialiasing').name('Antialiasing').onChange(function (value) {
    self.state.graphicsAntialiasing = value;
    self.saveState();
    window.location.reload();
  });

  folder1.add(this.state, 'downSampling', 1, 4).step(1).name('Down sampling').onChange(function (value) {
    self.state.downSampling = value;
    self.saveState();
    self.reinitializeGraphics();
  });

  var folder2 = this.gui.addFolder('Audio');

  folder2.add(this.state, 'audioVoiceChat', 0, 10).step(0.25).name('Voice chat').onChange(function (value) {
    self.state.audioVoiceChat = value;
    self.saveState();
  });

  folder2.add(this.state, 'audioVolume', 0, 10).step(0.25).name('Audio volume').onChange(function (value) {
    self.state.audioVolume = value;
    self.client.updateVolume();
    self.saveState();
  });

  this.gui.setOpacity(80);

  this.gui.close();
};

module.exports = Preferences;
