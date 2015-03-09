'use strict';

function Player(){
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();   
}

Player.createLabel = function( el )
{
  var name = el.attr('name'),
    fontface = "Arial",
    fontsize = 42,
    backgroundColor = { r:0, g:0, b:0, a:0.5 },
    canvas = document.createElement('canvas'),
    context = canvas.getContext('2d');

  canvas.width = 256;
  canvas.height = 64;
  context.font = "bold 42px arial";

  // get size data (height depends only on font size)
  var metrics = context.measureText(name),
    textWidth = Math.ceil(metrics.width);
  
  // background color
  context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
  context.strokeStyle = "rgba(0, 0, 0, 0)";
  context.lineWidth = 0;
  roundRect(context, 128 - 10 - textWidth / 2, 0, textWidth + 20, fontsize * 1.4, fontsize * 0.7);
  
  // text color
  context.fillStyle = "rgba(255, 255, 255, 1.0)";
  context.strokeStyle = "rgba(255, 255, 255, 1.0)";
  context.textAlign = "center"
  context.textBaseline = "middle";
  context.font = "bold 42px arial";
  context.fillText( name, 128, 30);
  
  // canvas contents will be used for a texture
  var texture = new THREE.Texture(canvas) 
  texture.needsUpdate = true;

  var spriteMaterial = new THREE.SpriteMaterial( { map : texture } );
  var sprite = new THREE.Sprite( spriteMaterial );
  sprite.scale.set(1.0, 0.25, 1.0);
  sprite.position.set(0, 1.2, 0);

  return sprite;  
}

module.exports = Player;