function Vanilla (client, renderer) {
  this.client = client;
  this.renderer = renderer;
}

Vanilla.prototype.render = function (scene, camera) {
  this.renderer.clear(true, true, true);
  this.renderer.render(scene, camera);
};

module.exports = Vanilla;
