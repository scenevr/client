var util = require('util');
var Element = require('./element');
var Howl = require('howler').Howl;

var THREE = window.THREE;

function Audio (connector, el) {
  this.connector = connector;
  this.el = el;
}

util.inherits(Audio, Element);

Audio.prototype.play = function () {
  this.sound.pos3d(
    this.connector.client.getPlayerObject().position.clone().sub(this.obj.position)
  );

  console.log('eh?');

  this.sound.play();
};

Audio.prototype.create = function () {
  this.obj = new THREE.Object3D();

  this.setPosition();

  this.sound = new Howl({
    urls: [this.resolveURI(this.el.attr('src'))],
    autoplay: false,
    loop: false,
    volume: this.el.attr('volume') || 1.0
  });

  return this.obj;
};

module.exports = Audio;
