Utils = require "../utils.coffee"
StyleMap = require("../style_map")

DEFAULT_COLOR = "#ffffff"
DEFAULT_NEAR = 100
DEFAULT_FAR = 1000

class Fog
  constructor: ->
    true

Fog.create = (connector, el) ->
  styles = new StyleMap(el.attr("style"))
  color = styles.color || DEFAULT_COLOR
  near = parseInt(el.attr("near") || DEFAULT_NEAR)
  far = parseInt(el.attr("far") || DEFAULT_FAR)

  connector.scene.fog = new THREE.Fog( color, near, far )
    
module.exports = Fog