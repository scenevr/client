var StyleMap = require('../style-map');
var THREE = require('three');

function Skybox () {
}

Skybox.create = function (connector, el) {
  var material = null;
  var src = el.attr('src');
  var color = new StyleMap(el.attr('style')).color;

  if (src) {
    var path = connector.getAssetHost() + src.replace(/\..+?$/, '');
    var format = src.replace(/.+\./, '.');
    var urls = [path + 'right' + format, path + 'left' + format, path + 'top' + format, path + 'bottom' + format, path + 'front' + format, path + 'back' + format];
    THREE.ImageUtils.crossOrigin = true;

    var reflectionCube = THREE.ImageUtils.loadTextureCube(urls);
    reflectionCube.format = THREE.RGBFormat;

    var shader = THREE.ShaderLib['cube'];
    shader.uniforms['tCube'].value = reflectionCube;

    material = new THREE.ShaderMaterial({
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
      uniforms: shader.uniforms,
      depthWrite: false,
      side: THREE.BackSide
    });
  } else if (color) {
    if (color.match(/linear-gradient/)) {
      var _ref = color.match(/#.+?\b/g);
      var start = _ref[0];
      var finish = _ref[1];

      var vertexShader = 'varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4( position, 1.0 ); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';
      var fragmentShader = 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize( vWorldPosition + offset ).y; gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 ); }';
      var uniforms = {
        topColor: {
          type: 'c',
          value: new THREE.Color(finish)
        },
        bottomColor: {
          type: 'c',
          value: new THREE.Color(start)
        },
        offset: {
          type: 'f',
          value: 0
        },
        exponent: {
          type: 'f',
          value: 0.6
        }
      };

      material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
      });
    } else {
      material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.BackSide
      });
    }
  } else {
    material = new THREE.MeshBasicMaterial({
      color: '#eeeeee',
      side: THREE.BackSide
    });
  }

  var distance = 2048;
  
  return new THREE.Mesh(new THREE.BoxGeometry(distance, distance, distance), material);
};

module.exports = Skybox;
