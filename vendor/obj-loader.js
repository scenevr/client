var resolveURI;

/**
 * Loads a Wavefront .mtl file specifying materials
 *
 * @author angelxuanchang
 */

THREE.MTLLoader = function( baseUrl, options, crossOrigin, resolveURI ) {

  this.baseUrl = baseUrl;
  this.options = options;
  this.crossOrigin = crossOrigin;
  this.resolveURI = resolveURI;

};

THREE.MTLLoader.prototype = {

  constructor: THREE.MTLLoader,

  load: function ( url, onLoad, onProgress, onError ) {

    var scope = this;

    var loader = new THREE.XHRLoader();
    loader.setCrossOrigin( this.crossOrigin );
    loader.load( url, function ( text ) {

      onLoad( scope.parse( text ) );

    }, onProgress, onError );

  },

  /**
   * Parses loaded MTL file
   * @param text - Content of MTL file
   * @return {THREE.MTLLoader.MaterialCreator}
   */
  parse: function ( text ) {

    var lines = text.split( "\n" );
    var info = {};
    var delimiter_pattern = /\s+/;
    var materialsInfo = {};

    for ( var i = 0; i < lines.length; i ++ ) {

      var line = lines[ i ];
      line = line.trim();

      if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

        // Blank line or comment ignore
        continue;

      }

      var pos = line.indexOf( ' ' );

      var key = ( pos >= 0 ) ? line.substring( 0, pos ) : line;
      key = key.toLowerCase();

      var value = ( pos >= 0 ) ? line.substring( pos + 1 ) : "";
      value = value.trim();

      if ( key === "newmtl" ) {

        // New material

        info = { name: value };
        materialsInfo[ value ] = info;

      } else if ( info ) {

        if ( key === "ka" || key === "kd" || key === "ks" ) {

          var ss = value.split( delimiter_pattern, 3 );
          info[ key ] = [ parseFloat( ss[0] ), parseFloat( ss[1] ), parseFloat( ss[2] ) ];

        } else {

          info[ key ] = value;

        }

      }

    }

    var materialCreator = new THREE.MTLLoader.MaterialCreator( this.baseUrl, this.options );
    materialCreator.crossOrigin = this.crossOrigin
    materialCreator.setMaterials( materialsInfo );
    materialCreator.resolveURI = this.resolveURI;
    return materialCreator;

  }

};

/**
 * Create a new THREE-MTLLoader.MaterialCreator
 * @param baseUrl - Url relative to which textures are loaded
 * @param options - Set of options on how to construct the materials
 *                  side: Which side to apply the material
 *                        THREE.FrontSide (default), THREE.BackSide, THREE.DoubleSide
 *                  wrap: What type of wrapping to apply for textures
 *                        THREE.RepeatWrapping (default), THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping
 *                  normalizeRGB: RGBs need to be normalized to 0-1 from 0-255
 *                                Default: false, assumed to be already normalized
 *                  ignoreZeroRGBs: Ignore values of RGBs (Ka,Kd,Ks) that are all 0's
 *                                  Default: false
 *                  invertTransparency: If transparency need to be inverted (inversion is needed if d = 0 is fully opaque)
 *                                      Default: false (d = 1 is fully opaque)
 * @constructor
 */

THREE.MTLLoader.MaterialCreator = function( baseUrl, options ) {

  this.baseUrl = baseUrl;
  this.options = options;
  this.materialsInfo = {};
  this.materials = {};
  this.materialsArray = [];
  this.nameLookup = {};

  this.side = ( this.options && this.options.side ) ? this.options.side : THREE.FrontSide;
  this.wrap = ( this.options && this.options.wrap ) ? this.options.wrap : THREE.RepeatWrapping;

};

THREE.MTLLoader.MaterialCreator.prototype = {

  constructor: THREE.MTLLoader.MaterialCreator,

  setMaterials: function( materialsInfo ) {

    this.materialsInfo = this.convert( materialsInfo );
    this.materials = {};
    this.materialsArray = [];
    this.nameLookup = {};

  },

  convert: function( materialsInfo ) {

    if ( !this.options ) return materialsInfo;

    var converted = {};

    for ( var mn in materialsInfo ) {

      // Convert materials info into normalized form based on options

      var mat = materialsInfo[ mn ];

      var covmat = {};

      converted[ mn ] = covmat;

      for ( var prop in mat ) {

        var save = true;
        var value = mat[ prop ];
        var lprop = prop.toLowerCase();

        switch ( lprop ) {

          case 'kd':
          case 'ka':
          case 'ks':

            // Diffuse color (color under white light) using RGB values

            if ( this.options && this.options.normalizeRGB ) {

              value = [ value[ 0 ] / 255, value[ 1 ] / 255, value[ 2 ] / 255 ];

            }

            if ( this.options && this.options.ignoreZeroRGBs ) {

              if ( value[ 0 ] === 0 && value[ 1 ] === 0 && value[ 1 ] === 0 ) {

                // ignore

                save = false;

              }
            }

            break;

          case 'd':

            // According to MTL format (http://paulbourke.net/dataformats/mtl/):
            //   d is dissolve for current material
            //   factor of 1.0 is fully opaque, a factor of 0 is fully dissolved (completely transparent)

            if ( this.options && this.options.invertTransparency ) {

              value = 1 - value;

            }

            break;

          default:

            break;
        }

        if ( save ) {

          covmat[ lprop ] = value;

        }

      }

    }

    return converted;

  },

  preload: function () {

    for ( var mn in this.materialsInfo ) {

      this.create( mn );

    }

  },

  getIndex: function( materialName ) {

    return this.nameLookup[ materialName ];

  },

  getAsArray: function() {

    var index = 0;

    for ( var mn in this.materialsInfo ) {

      this.materialsArray[ index ] = this.create( mn );
      this.nameLookup[ mn ] = index;
      index ++;

    }

    return this.materialsArray;

  },

  create: function ( materialName ) {

    if ( this.materials[ materialName ] === undefined ) {

      this.createMaterial_( materialName );

    }

    return this.materials[ materialName ];

  },

  createMaterial_: function ( materialName ) {

    // Create material

    var mat = this.materialsInfo[ materialName ];
    var params = {

      name: materialName,
      side: this.side

    };

    function stripPath(path) {
      return path;
      // return path.replace(/^.+[\/\\]/, '/');
    }

    for ( var prop in mat ) {

      var value = mat[ prop ];

      switch ( prop.toLowerCase() ) {

        // Ns is material specular exponent

        case 'kd':

          // Diffuse color (color under white light) using RGB values

          params[ 'diffuse' ] = new THREE.Color().fromArray( value );

          break;

        case 'ka':

          // Ambient color (color under shadow) using RGB values

          break;

        case 'ks':

          // Specular color (color when light is reflected from shiny surface) using RGB values
          params[ 'specular' ] = new THREE.Color().fromArray( value );

          break;

        case 'map_kd':

          // Diffuse texture map

          params[ 'map' ] = this.loadTexture( this.resolveURI(this.baseUrl, stripPath(value)) );
          params[ 'map' ].wrapS = this.wrap;
          params[ 'map' ].wrapT = this.wrap;

          break;

        case 'ns':

          // The specular exponent (defines the focus of the specular highlight)
          // A high exponent results in a tight, concentrated highlight. Ns values normally range from 0 to 1000.

          params['shininess'] = value;

          break;

        case 'd':

          // According to MTL format (http://paulbourke.net/dataformats/mtl/):
          //   d is dissolve for current material
          //   factor of 1.0 is fully opaque, a factor of 0 is fully dissolved (completely transparent)

          if ( value < 1 ) {

            params['transparent'] = true;
            params['opacity'] = value;

          }

          break;

        case 'map_bump':
        case 'bump':

          // Bump texture map

          if ( params[ 'bumpMap' ] ) break; // Avoid loading twice.

          params[ 'bumpMap' ] = this.loadTexture(this.resolveURI(this.baseUrl, stripPath(value)) );
          params[ 'bumpMap' ].wrapS = this.wrap;
          params[ 'bumpMap' ].wrapT = this.wrap;

          break;

        default:
          break;

      }

    }

    if ( params[ 'diffuse' ] ) {

      params[ 'color' ] = params[ 'diffuse' ];

    }

    this.materials[ materialName ] = new THREE.MeshLambertMaterial( params );
    return this.materials[ materialName ];

  },


  loadTexture: function ( url, mapping, onLoad, onError ) {

    var texture;
    var loader = THREE.Loader.Handlers.get( url );

    if ( loader !== null ) {

      texture = loader.load( url, onLoad );

    } else {

      texture = new THREE.Texture();

      loader = new THREE.ImageLoader();
      loader.crossOrigin = this.crossOrigin;
      loader.load( url, function ( image ) {

        texture.image = THREE.MTLLoader.ensurePowerOfTwo_( image );
        texture.needsUpdate = true;

        if ( onLoad ) onLoad( texture );

      } );

    }

    if ( mapping !== undefined ) texture.mapping = mapping;

    return texture;

  }

};

THREE.MTLLoader.ensurePowerOfTwo_ = function ( image ) {

  if ( ! THREE.Math.isPowerOfTwo( image.width ) || ! THREE.Math.isPowerOfTwo( image.height ) ) {

    var canvas = document.createElement( "canvas" );
    canvas.width = THREE.MTLLoader.nextHighestPowerOfTwo_( image.width );
    canvas.height = THREE.MTLLoader.nextHighestPowerOfTwo_( image.height );

    var ctx = canvas.getContext("2d");
    ctx.drawImage( image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height );
    return canvas;

  }

  return image;

};

THREE.MTLLoader.nextHighestPowerOfTwo_ = function( x ) {

  -- x;

  for ( var i = 1; i < 32; i <<= 1 ) {

    x = x | x >> i;

  }

  return x + 1;

};

THREE.EventDispatcher.prototype.apply( THREE.MTLLoader.prototype );

THREE.OBJLoader = function () {
}

THREE.OBJLoader.prototype = {

  constructor: THREE.OBJLoader,

  load: function ( url, onLoad, onProgress, onError ) {

    var scope = this;

    var loader = new THREE.XHRLoader( scope.manager );
    loader.setCrossOrigin( this.crossOrigin );
    loader.load( url, function ( text ) {

      onLoad( scope.parse( text ) );

    }, onProgress, onError );

  },

  parse: function ( text ) {

    //console.time( 'OBJLoader' );

    var object, objects = [];
    var geometry, material;

    function parseVertexIndex( value ) {

      var index = parseInt( value );

      return ( index >= 0 ? index - 1 : index + vertices.length / 3 ) * 3;

    }

    function parseNormalIndex( value ) {

      var index = parseInt( value );

      return ( index >= 0 ? index - 1 : index + normals.length / 3 ) * 3;

    }

    function parseUVIndex( value ) {

      var index = parseInt( value );

      return ( index >= 0 ? index - 1 : index + uvs.length / 2 ) * 2;

    }

    function addVertex( a, b, c ) {

      geometry.vertices.push(
        vertices[ a ], vertices[ a + 1 ], vertices[ a + 2 ],
        vertices[ b ], vertices[ b + 1 ], vertices[ b + 2 ],
        vertices[ c ], vertices[ c + 1 ], vertices[ c + 2 ]
      );

    }

    function addNormal( a, b, c ) {

      geometry.normals.push(
        normals[ a ], normals[ a + 1 ], normals[ a + 2 ],
        normals[ b ], normals[ b + 1 ], normals[ b + 2 ],
        normals[ c ], normals[ c + 1 ], normals[ c + 2 ]
      );

    }

    function addUV( a, b, c ) {

      geometry.uvs.push(
        uvs[ a ], uvs[ a + 1 ],
        uvs[ b ], uvs[ b + 1 ],
        uvs[ c ], uvs[ c + 1 ]
      );

    }

    function addFace( a, b, c, d,  ua, ub, uc, ud,  na, nb, nc, nd ) {

      var ia = parseVertexIndex( a );
      var ib = parseVertexIndex( b );
      var ic = parseVertexIndex( c );

      if ( d === undefined ) {

        addVertex( ia, ib, ic );

      } else {

        var id = parseVertexIndex( d );

        addVertex( ia, ib, id );
        addVertex( ib, ic, id );

      }

      if ( ua !== undefined ) {

        var ia = parseUVIndex( ua );
        var ib = parseUVIndex( ub );
        var ic = parseUVIndex( uc );

        if ( d === undefined ) {

          addUV( ia, ib, ic );

        } else {

          var id = parseUVIndex( ud );

          addUV( ia, ib, id );
          addUV( ib, ic, id );

        }

      }

      if ( na !== undefined ) {

        var ia = parseNormalIndex( na );
        var ib = parseNormalIndex( nb );
        var ic = parseNormalIndex( nc );

        if ( d === undefined ) {

          addNormal( ia, ib, ic );

        } else {

          var id = parseNormalIndex( nd );

          addNormal( ia, ib, id );
          addNormal( ib, ic, id );

        }

      }

    }

    // create mesh if no objects in text

    if ( /^o /gm.test( text ) === false ) {

      geometry = {
        vertices: [],
        normals: [],
        uvs: []
      };

      material = {
        name: ''
      };

      object = {
        name: '',
        geometry: geometry,
        material: material
      };

      objects.push( object );

    }

    var vertices = [];
    var normals = [];
    var uvs = [];

    // v float float float

    var vertex_pattern = /v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

    // vn float float float

    var normal_pattern = /vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

    // vt float float

    var uv_pattern = /vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

    // f vertex vertex vertex ...

    var face_pattern1 = /f( +-?\d+)( +-?\d+)( +-?\d+)( +-?\d+)?/;

    // f vertex/uv vertex/uv vertex/uv ...

    var face_pattern2 = /f( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))?/;

    // f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...

    var face_pattern3 = /f( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))?/;

    // f vertex//normal vertex//normal vertex//normal ... 

    var face_pattern4 = /f( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))?/

    //

    var lines = text.split( '\n' );

    for ( var i = 0; i < lines.length; i ++ ) {

      var line = lines[ i ];
      line = line.trim();

      var result;

      if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

        continue;

      } else if ( ( result = vertex_pattern.exec( line ) ) !== null ) {

        // ["v 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

        vertices.push(
          parseFloat( result[ 1 ] ),
          parseFloat( result[ 2 ] ),
          parseFloat( result[ 3 ] )
        );

      } else if ( ( result = normal_pattern.exec( line ) ) !== null ) {

        // ["vn 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

        normals.push(
          parseFloat( result[ 1 ] ),
          parseFloat( result[ 2 ] ),
          parseFloat( result[ 3 ] )
        );

      } else if ( ( result = uv_pattern.exec( line ) ) !== null ) {

        // ["vt 0.1 0.2", "0.1", "0.2"]

        uvs.push(
          parseFloat( result[ 1 ] ),
          parseFloat( result[ 2 ] )
        );

      } else if ( ( result = face_pattern1.exec( line ) ) !== null ) {

        // ["f 1 2 3", "1", "2", "3", undefined]

        addFace(
          result[ 1 ], result[ 2 ], result[ 3 ], result[ 4 ]
        );

      } else if ( ( result = face_pattern2.exec( line ) ) !== null ) {

        // ["f 1/1 2/2 3/3", " 1/1", "1", "1", " 2/2", "2", "2", " 3/3", "3", "3", undefined, undefined, undefined]
        
        addFace(
          result[ 2 ], result[ 5 ], result[ 8 ], result[ 11 ],
          result[ 3 ], result[ 6 ], result[ 9 ], result[ 12 ]
        );

      } else if ( ( result = face_pattern3.exec( line ) ) !== null ) {

        // ["f 1/1/1 2/2/2 3/3/3", " 1/1/1", "1", "1", "1", " 2/2/2", "2", "2", "2", " 3/3/3", "3", "3", "3", undefined, undefined, undefined, undefined]

        addFace(
          result[ 2 ], result[ 6 ], result[ 10 ], result[ 14 ],
          result[ 3 ], result[ 7 ], result[ 11 ], result[ 15 ],
          result[ 4 ], result[ 8 ], result[ 12 ], result[ 16 ]
        );

      } else if ( ( result = face_pattern4.exec( line ) ) !== null ) {

        // ["f 1//1 2//2 3//3", " 1//1", "1", "1", " 2//2", "2", "2", " 3//3", "3", "3", undefined, undefined, undefined]

        addFace(
          result[ 2 ], result[ 5 ], result[ 8 ], result[ 11 ],
          undefined, undefined, undefined, undefined,
          result[ 3 ], result[ 6 ], result[ 9 ], result[ 12 ]
        );

      } else if ( /^o /.test( line ) ) {

        geometry = {
          vertices: [],
          normals: [],
          uvs: []
        };

        material = {
          name: ''
        };

        object = {
          name: line.substring( 2 ).trim(),
          geometry: geometry,
          material: material
        };

        objects.push( object )

      } else if ( /^g /.test( line ) ) {

        // group

      } else if ( /^usemtl /.test( line ) ) {

        geometry = {
          vertices: [],
          normals: [],
          uvs: []
        };

        material = {
          name: line.substring( 7 ).trim()
        };

        object = {
          name: line.substring( 2 ).trim(),
          geometry: geometry,
          material: material
        };

        objects.push( object )

      } else if ( /^mtllib /.test( line ) ) {

        // mtl file

      } else if ( /^s /.test( line ) ) {

        // smooth shading

      } else {

        // console.log( "THREE.OBJLoader: Unhandled line " + line );

      }

    }

    var container = new THREE.Object3D();

    for ( var i = 0, l = objects.length; i < l; i ++ ) {

      var object = objects[ i ];
      var geometry = object.geometry;

      var buffergeometry = new THREE.BufferGeometry();

      buffergeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( geometry.vertices ), 3 ) );

      if ( geometry.normals.length > 0 ) {
        buffergeometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( geometry.normals ), 3 ) );
      }

      if ( geometry.uvs.length > 0 ) {
        buffergeometry.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( geometry.uvs ), 2 ) );
      }

      var material = new THREE.MeshLambertMaterial();
      material.name = object.material.name;

      var mesh = new THREE.Mesh( buffergeometry, material );
      mesh.name = object.name;

      container.add( mesh );

    }

    // console.timeEnd( 'OBJLoader' );

    return container;

  }
}