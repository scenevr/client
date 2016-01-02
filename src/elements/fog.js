var StyleMap = require('../style-map');
var THREE = require('three.js');

var DEFAULT_COLOR = '#ffffff';
var DEFAULT_NEAR = 100;
var DEFAULT_FAR = 1000;

function Fog () {
}

Fog.create = function (connector, el) {
  var styles = new StyleMap(el.attr('style'));
  var color = styles.color || DEFAULT_COLOR;
  var near = parseInt(el.attr('near') || DEFAULT_NEAR, 10);
  var far = parseInt(el.attr('far') || DEFAULT_FAR, 10);

  connector.scene.fog = new THREE.Fog(color, near, far);

  return connector.scene.fog;
};

module.exports = Fog;
