var URI = require("uri-js"),
  Utils = require("../utils");

function Element(connector, el) {
  this.connector = connector;
  this.el = el;
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

// Has this element changed other than position and rotation? A and B should be
// raw dom / xml nodes, not jQuery wrapped nodes.
Element.substantialDifference = function(a, b){
  if(a.attributes.length != b.attributes.length){
    return true;
  }

  var i;

  for(i=0;i<a.attributes.length;i++){
    var name = a.attributes[i].name;

    if(name === "position"){
      continue;
    }
    if(name === "rotation"){
      continue;      
    }
    if(a.getAttribute(name) != b.getAttribute(name)){
      return true;
    }
  }

  return false;
}

module.exports = Element;
