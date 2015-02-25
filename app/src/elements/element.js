(function() {
  var Element, URI, Utils;

  Utils = require("../utils");

  URI = require("uri-js");

  Element = (function() {
    function Element(connector, el) {
      this.connector = connector;
      this.el = el;
      true;
    }

    Element.prototype.resolveURI = function(url) {
      return URI.resolve(this.connector.uri, url);
    };

    Element.prototype.getPosition = function() {
      if (this.el.attr("position")) {
        return Utils.parseVector(el.attr("position"));
      } else {
        throw "No position specified for <" + this.el[0].nodeName + " />";
      }
    };

    Element.prototype.getQuaternion = function() {
      if (this.el.attr("rotation")) {
        return new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr("rotation")));
      } else {
        return new THREE.Quaternion();
      }
    };

    Element.prototype.getScale = function() {
      if (this.el.attr("scale")) {
        return Utils.parseVector(this.el.attr("scale"));
      } else {
        return new THREE.Vector3(1, 1, 1);
      }
    };

    return Element;

  })();

  module.exports = Element;

}).call(this);
