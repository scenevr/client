var THREE = window.THREE;

function Player () {
}

Player.create = function (connetor, el) {
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

function roundRect (ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

Player.createLabel = function (el) {
  var name = el.attr('name');
  var fontface = 'arial';
  var fontsize = 42;
  var backgroundColor = { r: 0, g: 0, b: 0, a: 0.5 };
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');

  canvas.width = 256;
  canvas.height = 64;
  context.font = 'bold ' + fontsize + 'px ' + fontface;

  // get size data (height depends only on font size)
  var metrics = context.measureText(name);
  var textWidth = Math.ceil(metrics.width);

  // background color
  context.fillStyle = 'rgba(' + backgroundColor.r + ',' + backgroundColor.g + ',' + backgroundColor.b + ',' + backgroundColor.a + ')';
  context.strokeStyle = 'rgba(0, 0, 0, 0)';
  context.lineWidth = 0;
  roundRect(context, 128 - 10 - textWidth / 2, 0, textWidth + 20, fontsize * 1.4, fontsize * 0.7);

  // text color
  context.fillStyle = 'rgba(255, 255, 255, 1.0)';
  context.strokeStyle = 'rgba(255, 255, 255, 1.0)';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold ' + fontsize + 'px ' + fontface;
  context.fillText(name, 128, 30);

  // canvas contents will be used for a texture
  var texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  var spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  var sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.0, 0.25, 1.0);
  sprite.position.set(0, 1.2, 0);

  return sprite;
};

module.exports = Player;
