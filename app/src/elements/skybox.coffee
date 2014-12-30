Utils = require "../utils.coffee"
StyleMap = require("../style_map")

class Skybox
  constructor: ->
    true

Skybox.create = (connector, el) ->
  material = null

  if src = el.attr("src")
    path = "//" + connector.getAssetHost() + src.replace(/\..+?$/,'')
    format = src.replace(/.+\./,'.')

    urls = [
      path + 'right' + format, path + 'left' + format,
      path + 'top' + format, path + 'bottom' + format,
      path + 'front' + format, path + 'back' + format
    ]

    THREE.ImageUtils.crossOrigin = true
    reflectionCube = THREE.ImageUtils.loadTextureCube( urls )
    reflectionCube.format = THREE.RGBFormat

    shader = THREE.ShaderLib[ "cube" ];
    shader.uniforms[ "tCube" ].value = reflectionCube

    material = new THREE.ShaderMaterial( {
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
      uniforms: shader.uniforms,
      depthWrite: false,
      side: THREE.BackSide
    } )
  else if color = new StyleMap(el.attr('style')).color
    if color.match /linear-gradient/

      [start, finish] = color.match(/#.+?\b/g)

      vertexShader = "
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      "

      fragmentShader = "
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;

        varying vec3 vWorldPosition;

        void main() {
          float h = normalize( vWorldPosition + offset ).y;
          gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
        }
      "

      uniforms = {
        topColor:    { type: "c", value: new THREE.Color( finish ) },
        bottomColor: { type: "c", value: new THREE.Color( start ) },
        offset:    { type: "f", value: 0 },
        exponent:  { type: "f", value: 0.6 }
      }

      material = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
      } )
    else
      material = new THREE.MeshBasicMaterial( { color : color, side : THREE.BackSide })
  else
    material = new THREE.MeshBasicMaterial( { color : '#eeeeee', side : THREE.BackSide })

  new THREE.Mesh( new THREE.BoxGeometry( 200, 200, 200 ), material );
    
module.exports = Skybox