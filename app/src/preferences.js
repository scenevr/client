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

module.exports = Preferences;
