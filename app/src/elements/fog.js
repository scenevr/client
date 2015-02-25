(function() {
  var DEFAULT_COLOR, DEFAULT_FAR, DEFAULT_NEAR, Fog, StyleMap, Utils;

  Utils = require("../utils");

  StyleMap = require("../style_map");

  DEFAULT_COLOR = "#ffffff";

  DEFAULT_NEAR = 100;

  DEFAULT_FAR = 1000;

  Fog = (function() {
    function Fog() {
      true;
    }

    return Fog;

  })();

  Fog.create = function(connector, el) {
    var color, far, near, styles;
    styles = new StyleMap(el.attr("style"));
    color = styles.color || DEFAULT_COLOR;
    near = parseInt(el.attr("near") || DEFAULT_NEAR);
    far = parseInt(el.attr("far") || DEFAULT_FAR);
    return connector.scene.fog = new THREE.Fog(color, near, far);
  };

  module.exports = Fog;

}).call(this);
