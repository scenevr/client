var URI = require('uri-js');
var Utils = require('../utils');
var THREE = require('three.js');

function Element () {
}

Element.prototype.resolveURI = function (url) {
  return URI.resolve(URI.serialize(this.connector.assetUri), url);
};

Element.prototype.getPosition = function () {
  if (this.el.attr('position')) {
    return Utils.parseVector(this.el.attr('position'));
  } else {
    throw new Error('No position specified for <' + this.el[0].nodeName + ' />');
  }
};

Element.prototype.setPosition = function () {
  this.obj.position.copy(this.getPosition());
};

Element.prototype.getQuaternion = function () {
  if (this.el.attr('rotation')) {
    return new THREE.Quaternion().setFromEuler(Utils.parseEuler(this.el.attr('rotation')));
  } else {
    return new THREE.Quaternion();
  }
};

Element.prototype.getScale = function () {
  if (this.el.attr('scale')) {
    return Utils.parseVector(this.el.attr('scale'));
  } else {
    return new THREE.Vector3(1, 1, 1);
  }
};

// Has this element changed other than position and rotation? A and B should be
// raw dom / xml nodes, not jQuery wrapped nodes.
Element.substantialDifference = function (a, b) {
  if (a.attributes.length !== b.attributes.length) {
    return true;
  }

  if (a.innerHTML !== b.innerHTML) {
    return true;
  }

  var i;

  for (i = 0; i < a.attributes.length; i++) {
    var name = a.attributes[i].name;

    if (name === 'position') {
      continue;
    }
    if (name === 'rotation') {
      continue;
    }
    if (a.getAttribute(name) !== b.getAttribute(name)) {
      return true;
    }
  }

  return false;
};

module.exports = Element;
