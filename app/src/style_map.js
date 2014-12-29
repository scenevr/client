'use strict';

function hyphenatedToCamelcase(key){
  return key.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
}

function camelcaseToHyphenated(key){
  return key.replace(/([A-Z])/g, function (g) { return '-' + g[0].toLowerCase(); });
}

var StyleMap = function(style) {
  var self = this
  if (style) style.split(/\s*;\s*/g).map(function(val) {
    val = val.split(/\s*:\s*/)
    if(val[1]) self[hyphenatedToCamelcase(val[0])] = val[1]
  })
}

StyleMap.prototype.valueOf = function() {
  var self = this
  return Object.keys(self).map(function(key) {
    return camelcaseToHyphenated(key) + ": " + self[key]
  }).join("; ")
}

module.exports = StyleMap;