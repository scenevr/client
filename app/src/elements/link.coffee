Element = require "./element.coffee"

DEFAULT_COLOR = "#ff7700"

class Link extends Element
  create: ->
    styles = new StyleMap(@el.attr("style"))
    color = styles.color || DEFAULT_COLOR

    @obj = new THREE.Object3D

    geometry2 = new THREE.SphereGeometry( 0.25, 16, 16 )
    material2 = new THREE.MeshPhongMaterial( {color: color, emissive : color, transparent : true, opacity: 0.5 } )
    @obj.add(new THREE.Mesh( geometry2, material2 ))

    geometry = new THREE.SphereGeometry( 0.12, 16, 16 )
    material = new THREE.MeshPhongMaterial( {color: color, emissive : color } )
    @obj.add(new THREE.Mesh( geometry, material ))

    @obj.onClick = @onClick
    @obj.body = null
    @obj

  onClick: =>
    if @connector.portal && @connector.portal.obj == @obj
      @closePortal()
    else if @connector.portal
      @closePortal()
      @createPortal()
    else
      @createPortal()

  closePortal: ->
    @connector.closePortal()

  createPortal: ->
    @connector.loadPortal(@el, @obj)

    while @obj.children[0]
      @obj.remove(@obj.children[0])
      
    glowTexture = new THREE.ImageUtils.loadTexture( '/images/portal.png' )
    glowTexture.wrapS = glowTexture.wrapT = THREE.RepeatWrapping;
    glowTexture.repeat.set( 1, 1 )

    glowMaterial = new THREE.MeshBasicMaterial( { map: glowTexture, transparent : true, side : THREE.DoubleSide } );
    glowGeometry = new THREE.PlaneBufferGeometry(2, 2, 1, 1)
    glow = new THREE.Mesh(glowGeometry, glowMaterial)

    portalMaterial = new THREE.MeshBasicMaterial { color : '#000000', side : THREE.DoubleSide }
    portalGeometry = new THREE.CircleGeometry(1 * 0.75, 40)
    portal = new THREE.Mesh(portalGeometry, portalMaterial)
    portal.position.z = 0.001

    @obj.add(glow)
    @obj.add(portal)

    portalClone = portal.clone()
    portalClone.position.copy(@getPosition())
    portalClone.position.z += 0.1
    portalClone.visible = true

    if @getQuaternion()
      portalClone.quaternion.copy(@getQuaternion())

    portalClone.updateMatrix()
    portalClone.updateMatrixWorld(true)
    portalClone.matrixAutoUpdate = false
    portalClone.frustumCulled = false

    @connector.stencilScene.add(portalClone)

module.exports = Link