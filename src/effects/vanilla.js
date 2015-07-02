var environment = require('../environment');

function Vanilla (client, renderer) {
  this.client = client;
  this.renderer = renderer;
}

Vanilla.prototype.render = function (scene, camera) {
  if (environment.ambientOcclusionEnabled()) {
    scene.overrideMaterial = this.client.depthMaterial;
    this.renderer.clearTarget(this.client.depthTarget, true, true, true);
    this.renderer.render(scene, camera, this.client.depthTarget);

    scene.overrideMaterial = null;
    this.client.composer.render();
  } else {
    this.renderer.clear(true, true, true);
    this.renderer.render(scene, camera);
  }
};

module.exports = Vanilla;
