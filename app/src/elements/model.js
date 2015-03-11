var Utils = require("../utils"),
  StyleMap = require("../style_map"),
  Element = require("./element");

function Model() {
}

Model.create = function(connector, el) {
  var obj, styles;

  obj = new THREE.Object3D;
  texture = null;
  styles = new StyleMap(el.attr("style"));

  var material = null;

  if (el.attr("style")) {
    if (styles['color']) {
      material = new THREE.MeshLambertMaterial({
        color: styles['color']
      });
    }

    if (styles.lightMap || styles.textureMap) {
      material = styles.textureMap ? new THREE.MeshLambertMaterial : new THREE.MeshBasicMaterial;

      var texture = new THREE.Texture();
      var loader = new THREE.ImageLoader(this.manager);

      loader.crossOrigin = true;

      loader.load("//" + connector.getAssetHost() + StyleMap.parseUrl(styles.lightMap || styles.textureMap), function(image) {
        texture.image = image;
        texture.needsUpdate = true;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

        var repeatX = 1,
          repeatY = 1;

        if(styles.textureRepeat){
          repeatX = parseFloat(styles.textureRepeat.split(" ")[0]);
          repeatY = parseFloat(styles.textureRepeat.split(" ")[1]);
        }
        if(styles.textureRepeatX){
          repeatX = parseFloat(styles.textureRepeatX);
        }
        if(styles.textureRepeatY){
          repeatY = parseFloat(styles.textureRepeatY);
        }

        texture.repeat.set(repeatX, repeatY);

        material.map = texture;
        material.needsUpdate = true;
      });
    }

  }

  var self = this,
    objLoader = new THREE.OBJLoader(this.manager);

  objLoader.load("//" + connector.getAssetHost() + el.attr("src"), function(object){
    object.traverse(function(child) {
      var boundingBox, boxBody, boxShape, dimensions;

      if (child instanceof THREE.Mesh) {
        child.material = material;

        if (styles.collision === "mesh"){
          window.mesh = child;

          var vertices = child.geometry.attributes.position.array,
            indices = [],
            i = 0;

          // This is a bit gross, but it works
          for(i=0;i<vertices.length;i++){
            indices.push(i);
          } 

          var trimeshShape = new CANNON.Trimesh(vertices, indices);
          trimeshBody = new CANNON.Body({ mass: 0 });
          trimeshBody.addShape(trimeshShape);

          trimeshBody.position.copy(obj.position);
          trimeshBody.quaternion.copy(obj.quaternion);
          trimeshBody.uuid = el.attr('uuid');

          obj.body = trimeshBody;

          // Gross - too much coupling
          connector.physicsWorld.add(obj.body);

        } else if ((styles.collision == null) || (styles.collision === 'bounding-box')) {
          child.geometry.computeBoundingBox();
          boundingBox = child.geometry.boundingBox.clone();
          dimensions = boundingBox.max.sub(boundingBox.min);

          boxShape = new CANNON.Box(new CANNON.Vec3().copy(dimensions.multiplyScalar(0.5)));
          boxBody = new CANNON.Body({
            mass: 0
          });

          boxBody.addShape(boxShape);
          boxBody.position.copy(obj.position);
          boxBody.quaternion.copy(obj.quaternion);
          boxBody.uuid = el.attr('uuid');

          obj.body = boxBody;

          // Gross - too much coupling
          connector.physicsWorld.add(obj.body);
        }
      }
      
      obj.add(object);
    });
  });

  newScale = el.attr("scale") ? Utils.parseVector(el.attr("scale")) : new THREE.Vector3(1, 1, 1);
  obj.scale.copy(newScale);

  return obj;
};

module.exports = Model;