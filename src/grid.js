/* globals fetch */

var THREE = require('three');
var CANNON = require('cannon');
var Connector = require('./connector');

class Grid {
  constructor (client) {
    this.client = client;
    this.connectors = {};
  }

  addConnector (connector, coordinate) {
    var index = [coordinate.x, coordinate.y].join('x');
    this.connectors[index] = connector;

    // lol decoupling
    connector.coordinate = coordinate;
  }

  getConnector (coordinate) {
    var index = [coordinate.x, coordinate.y].join('x');
    return this.connectors[index];
  }

  unloadConnector (connector) {
    Object.keys(this.connectors).forEach((key) => {
      if (this.connectors[key] === connector) {
        connector.destroy();
        delete this.connectors[key];
      }
    });
  }

  getVisibleConnectors () {
    // var position = this.getPlayerPosition();
    var results = [];

    this.forEach((connector) => {
      // Add some test for distance
      results.push(connector);
    });

    return results;
  }

  forEach (func) {
    Object.keys(this.connectors).forEach((key) => {
      func(this.connectors[key], key);
    });
  }

  disconnect () {
    this.forEach((connector) => {
      connector.disconnect();
    });
  }

  purgeDistantConnectors (position) {
    // unload any connectors that are far away from the current position
  }

  getWorldOffset (coord) {
    return new THREE.Vector3(coord.x * Grid.SIZE, 0, coord.y * Grid.SIZE);
  }

  getGridCoordinate (position) {
    return new THREE.Vector2(position.x / Grid.SIZE, position.z / Grid.SIZE).roundToZero();
  }

  getConnectorForPosition (position) {
    return this.getConnector(this.getGridCoordinate(position));
  }

  // Get the current grid coordinate and the 8 surrounding ones
  getAdjacentGridCoordinates (position) {
    var coord = this.getGridCoordinate(position);
    var results = [coord];

    // results.push(coord.clone().add(new THREE.Vector2(-1, -1)));
    results.push(coord.clone().add(new THREE.Vector2(0, -1)));
    // results.push(coord.clone().add(new THREE.Vector2(1, -1)));
    results.push(coord.clone().add(new THREE.Vector2(-1, 0)));
    results.push(coord.clone().add(new THREE.Vector2(1, 0)));
    // results.push(coord.clone().add(new THREE.Vector2(-1, 1)));
    results.push(coord.clone().add(new THREE.Vector2(0, 1)));
    // results.push(coord.clone().add(new THREE.Vector2(1, 1)));

    return results;
  }

  loadGridConnector (coord) {
    this.getConnectorUrl(coord, (err, url) => {
      if (err) {
        console.log(err);
        return;
      }

      var obj = new THREE.Object3D();
      obj.position.copy(this.getWorldOffset(coord));
      this.client.scene.add(obj);

      var connector = new Connector(this.client, obj, new CANNON.World(), url);
      connector.connect();
      this.addConnector(connector, coord);
    });
  };

  getPlayerPosition () {
    return this.client.getPlayerObject().position;
  }

  loadConnectors () {
    var coordinates = this.getAdjacentGridCoordinates(this.getPlayerPosition());

    coordinates.forEach((coord) => {
      this.loadGridConnector(coord);
    });
  };

  getConnectorUrl (coordinate, callback) {
    var url = 'https://www.scenevr.com/scenes/grid.json?x=' + coordinate.x + '&y=' + coordinate.y;

    console.log(url);

    fetch(url).then((response) => {
      return response.json();
    }).then((json) => {
      if (json.uri) {
        callback(false, json.uri);
      } else {
        callback('Scene not found for this coordinate');
      }
    });

    // callback(false, 'wss://scene-reddit.herokuapp.com/gallery.xml?subreddit=aww');
  }

  inspect () {
    return JSON.stringify(this.connectors);
  }

}

Grid.SIZE = 64;

module.exports = Grid;
