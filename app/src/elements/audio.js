var util = require('util');
var Element = require('./element');
var Howl = require('howler').Howl;

var THREE = window.THREE;

function Audio (connector, el) {
  this.connector = connector;
  this.el = el;
}

util.inherits(Audio, Element);

Audio.prototype.updateVolume = function () {
  var v = this.el.attr('volume') || 1.0;
  this.sound.volume(this.connector.client.preferences.getState().audioVolume * 0.1 * v);
};

Audio.prototype.play = function () {
  this.sound.stop();
  this.sound.play();
  this.updateVolume();
};

Audio.prototype.stop = function () {
  this.sound.stop();
};

Audio.prototype.create = function () {
  this.obj = new THREE.Object3D();

  this.sound = new Howl({
    urls: [this.resolveURI(this.el.attr('src'))],
    autoplay: false,
    loop: false
  });

  return this.obj;
};

module.exports = Audio;
