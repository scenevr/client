var palette = require('./data/palette');

var h = require('virtual-dom/h');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var createElement = require('virtual-dom/create-element');

function renderButton (selected, color) {
  return h('button', {
    style: {
      backgroundColor: color,
      width: '24px',
      height: '24px',
      display: 'inline-block',
      border: selected ? '1px solid white' : '1px solid black',
      borderRadius: 2
    }
  }, [' ']);
}

function Editor (client) {
  this.client = client;
  this.initialize();
}

Editor.prototype.initialize = function () {
  var self = this;

  this.selectedIndex = 1;

  window.addEventListener('wheel', function (e) {
    self.selectedIndex -= Math.sign(e.deltaY);
    self.selectedIndex = Math.max(1, Math.min(palette.length, self.selectedIndex));
    self.rerender();
  });

  this.rerender();
};

Editor.prototype.rerender = function () {
  if (this.rootNode) {
    var newTree = this.render();
    var patches = diff(this.tree, newTree);
    this.rootNode = patch(this.rootNode, patches);
    this.tree = newTree;
  } else {
    this.tree = this.render();
    this.rootNode = createElement(this.tree);
    this.client.container[0].appendChild(this.rootNode);
  }
};

Editor.prototype.render = function () {
  var selection = palette[this.selectedIndex];

  var colors = palette.map(function (color) {
    return renderButton(color === selection, color);
  });

  return h('div', {
    style: {
      position: 'absolute',
      bottom: '8px',
      left: 0,
      right: 0,
      textAlign: 'center',
      zIndex: 20000
    }
  }, colors);
};

module.exports = Editor;
