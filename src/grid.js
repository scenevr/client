/* globals fetch */

var THREE = require('three.js');

class Grid {
  constructor () {
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

  getVisibleConnectors (position) {
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

  getGridCoordinate (position) {
    return new THREE.Vector2(position.x / Grid.SIZE, position.y / Grid.SIZE).roundToZero();
  }

  getConnectorForPosition (position) {
    return this.getConnector(this.getGridCoordinate(position));
  }

  getConnectorUrl (coordinate, callback) {
    var url = '/grid/' + [coordinate.x, coordinate.y].join('/') + '.xml';

    console.log(url);

    fetch(url).then((response) => {

    });

    callback(false, 'wss://scene-reddit.herokuapp.com/gallery.xml?subreddit=aww');
  }

  inspect () {
    return JSON.stringify(this.connectors);
  }

}

Grid.SIZE = 64;

module.exports = Grid;
