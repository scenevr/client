/* globals HMDVRDevice */

module.exports = function (callback) {
  var type = HMDVRDevice;

  navigator.getVRDevices().then(function (devices) {
    for (var i = 0; i < devices.length; i++) {
      if (devices[i] instanceof type) {
        var hmd = devices[i];

        if (!hmd.deviceName.match('webvr-polyfill')) {
          callback(false, devices[i]);
          break;
        }
      }
    };

    callback(false);
  });
};
