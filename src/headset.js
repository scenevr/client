
function Headset () {
  this.initialize();
};

Headset.prototype.initialize = function () {
  if (navigator.getVRDevices) {
    navigator.getVRDevices().then(this.onCallback.bind(this));
  } else if (navigator.mozGetVRDevices) {
    navigator.mozGetVRDevices(this.onCallback.bind(this));
  }
};

Headset.prototype.present = function () {
  return !!this.hmd;
}

Headset.prototype.onCallback = function (vrdevs) {
  var self = this;

  vrdevs.forEach(function (device) {
    if (device instanceof window.HMDVRDevice) {
      self.hmd = device;
    }
  });

  vrdevs.forEach(function (device) {
    if (device instanceof window.PositionSensorVRDevice && device.hardwareUnitId === self.hmd.hardwareUnitId) {
      self.sensor = device;
    }
  });

  if (this.present()) {
    this.renderer = new VRRenderer(this.renderer, this.vrHMD, this.vrHMDSensor);
    client.setRenderer(this.renderer);
    // this.vrrenderer 
    // self.consoleLog('VR HMD detected, using rift mode. Hit F to enable distortion.');
  }

  setTimeout(function () {
    var o = self.vrHMDSensor.getState().orientation;

    if ((o.x === 0) && (o.y === 0) && (o.z === 0)) {
      self.consoleLog('Hmm... Some issue with your HMD or browserf, we\'re not getting positional information.');
    }
  }, 2500);
};

Headset.prototype.addListeners = function (client) {
  var self = this;

  window.addEventListener('keypress', function (e) {
    if (self.vrrenderer && self.controls.enabled) {
      if (e.charCode === 'r'.charCodeAt(0)) {
        self.resetOrientation(client.controls, self.vrHMDSensor);
      }

      if (e.charCode === 'f'.charCodeAt(0)) {
        var el = client.domElement;

        if (el.mozRequestFullScreen) {
          el.mozRequestFullScreen({
            vrDisplay: self.vrHMD
          });
        }

        if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen({
            vrDisplay: self.vrHMD
          });
        }
      }
    }
  });
};

module.exports = Headset;
