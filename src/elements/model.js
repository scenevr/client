var Utils = require('../utils');
var StyleMap = require('../style-map');
var CANNON = require('cannon');
var THREE = require('three');

function Model () {
}

Model.create = function (connector, el) {
  var obj = new THREE.Object3D();
  var styles = new StyleMap(el.attr('style'));
  var material = null;

  if (!styles.color && !styles.lightMap && !styles.textureMap) {
    material = new THREE.MeshLambertMaterial({
      color: '#cccccc'
    });
  }

  if (styles.color) {
    material = new THREE.MeshLambertMaterial({
      color: styles['color']
    });
  }

  if (styles.metal) {
    material = new THREE.MeshPhongMaterial({
      color: styles['color']
    });
  }

  if (styles.lightMap || styles.textureMap) {
    material = styles.textureMap ? new THREE.MeshLambertMaterial({ color: 0x808080 }) : new THREE.MeshBasicMaterial({ });

    var texture = new THREE.Texture();
    var loader = new THREE.ImageLoader(this.manager);

    loader.crossOrigin = true;

    loader.load(connector.resolveAssetUrl(StyleMap.parseUrl(styles.lightMap || styles.textureMap)), function (image) {
      texture.image = image;
      texture.needsUpdate = true;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

      var repeatX = 1,
        repeatY = 1;

      if (styles.textureRepeat) {
        repeatX = parseFloat(styles.textureRepeat.split(' ')[0]);
        repeatY = parseFloat(styles.textureRepeat.split(' ')[1]);
      }
      if (styles.textureRepeatX) {
        repeatX = parseFloat(styles.textureRepeatX);
      }
      if (styles.textureRepeatY) {
        repeatY = parseFloat(styles.textureRepeatY);
      }

      texture.repeat.set(repeatX, repeatY);

      material.map = texture;
      material.needsUpdate = true;
    });
  }

  connector.client.assetManager.loadObj(connector.resolveAssetUrl(el.attr('src')), function (object) {
    if (el.attr('mtl')) {
      connector.client.assetManager.loadMtl(connector.resolveAssetUrl(el.attr('src').replace('.obj', '.mtl')), function (materialsCreator) {
        object.traverse(function (child) {
          if (child instanceof THREE.Mesh) {
            if (child.material.name) {
              var material = materialsCreator.create(child.material.name);

              if (material) {
                child.material = material;
              }
            }
          }
        });
      });
    } else {
      object.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
          child.material = material;
          child.castShadow = true;
          child.receiveShadow = !styles.lightMap;
        }
      });
    }

    object.traverse(function (child) {
      var boundingBox, boxBody, boxShape, dimensions;

      if (child instanceof THREE.Mesh) {
        if (styles.collision === 'none') {
          // No collision at all
        } else if (styles.collision === 'mesh') {
          var vertices = child.geometry.attributes.position.array;
          var indices = [];

          // This is a bit gross, but it works
          for (var i = 0; i < vertices.length; i++) {
            indices.push(i);
          }

          var trimeshShape = new CANNON.Trimesh(vertices, indices);
          var trimeshBody = new CANNON.Body({ mass: 0 });
          trimeshBody.addShape(trimeshShape);

          trimeshBody.position.copy(obj.position);
          trimeshBody.quaternion.copy(obj.quaternion);
          trimeshBody.uuid = el.attr('uuid');

          obj.body = trimeshBody;
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
        }

        if ((obj.body) && (styles.collisionResponse === 'false')) {
          obj.body.collisionResponse = false;
        }

        // Gross - too much coupling
        if (obj.body) {
          connector.physicsWorld.add(obj.body);
        }
      }

      obj.add(object);
    });
  });

  var scale = el.attr('scale') ? Utils.parseVector(el.attr('scale')) : new THREE.Vector3(1, 1, 1);
  obj.scale.copy(scale);

  return obj;
};

module.exports = Model;
