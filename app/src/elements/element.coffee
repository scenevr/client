Utils = require "../utils.coffee"
URI = require("uri-js")

class Element
  constructor: (@connector, @el)->
    true

  resolveURI: (url) ->
    URI.resolve(@connector.uri, url)

  getPosition: ->
    if @el.attr("position")
      Utils.parseVector(el.attr("position"))
    else
      throw "No position specified for <#{@el[0].nodeName} />"

  getQuaternion: ->
    if @el.attr("rotation")
      new THREE.Quaternion().setFromEuler(Utils.parseEuler(el.attr("rotation")))
    else
      new THREE.Quaternion()

  getScale: ->
    if @el.attr("scale")
      Utils.parseVector(@el.attr("scale"))
    else
      new THREE.Vector3(1,1,1)

module.exports = Element