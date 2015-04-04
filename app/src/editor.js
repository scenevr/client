var util = require('util');
var EventEmitter = require('wolfy87-eventemitter');
var CodeMirror = require('codemirror');
var $ = window.jQuery;

function Editor (client) {
  this.client = client;
  this.dragging = false;
  this.initialize();
}

util.inherits(Editor, EventEmitter);

Editor.prototype.initialize = function () {
  this.addHelpers();

  this.on('object:click', this.onClick.bind(this));

  this.client.on('controls:update', this.onUpdate.bind(this));

  this.loadSource();
};

Editor.prototype.loadSource = function () {
  var save = $('<button>Save</button>').appendTo('#editor');

  var textarea = $('<textarea />').appendTo('#editor');

  save.click(function () {
    $.ajax({
      url: 'http://localhost:8080/fs/hello.xml',
      method: 'post',
      data: textarea.val()
    });
  });

  $.ajax({
    url: 'http://localhost:8080/fs/hello.xml',
    success: function (text) {
      textarea.val(text);
      // var editor = CodeMirror.fromTextArea(textarea[0], {
      //   lineNumbers: true
      // });
    }
  });
};

Editor.prototype.inspect = function (el) {
  this.client.connector.inspectElement(el);
};

Editor.prototype.inspectResult = function (el) {
  var textarea = $('#editor textarea');
  var src = textarea.val();
  var startIndex = parseInt(el.attr('startindex'), 10);
  var newLines = src.substr(0, startIndex).match(/\n/g) || [];
  var lineNumber = newLines.length + 1;

  console.log(startIndex);
  console.log(lineNumber);

  textarea.focus();
  textarea[0].selectionStart = startIndex;
  this.client.exitPointerLock();
};

Editor.prototype.addHelpers = function(){
  this.sceneHelpers = this.client.scene;

  this.selectionBox = new THREE.BoundingBoxHelper(null, 0xFF7700);
  this.selectionBox.material.depthTest = false;
  this.selectionBox.material.transparent = true;

  this.sceneHelpers.add( this.selectionBox );
}

Editor.prototype.onClick = function (obj)  {
  this.inspect(obj.userData);

  return;

  if (this.dragging){
    this.endDrag();
  } else {
    this.selectedObject = obj;
    this.inspect(obj);
  }

  // if(obj && this.selectionBox.object){
  //   this.drop();
  // }else if (obj){
  //   this.pickup(obj);
  // }else{
  //   this.showMenu();
  // }
}

Editor.prototype.getDropPosition = function(){
  var player = this.client.controls.getObject().position,
    direction = this.client.controls.getDirection(new THREE.Vector3);
  
  return snapToGrid(player.clone().add(direction.multiplyScalar(2)));
}

Editor.prototype.getSelectedObject = function(){
  return this.selectedObject;
}

Editor.prototype.onAddCube = function(){
  var el = $("<box />").
    attr("position", this.getDropPosition().toArray().join(" ")).
    attr("style", "color : #f70");

  this.client.connector.createElement(el);
}

Editor.prototype.onRemove = function(){
  this.client.connector.removeElement(this.getSelectedObject().userData);
}

Editor.prototype.onDrag = function(){
  this.startDragging();
}

Editor.prototype.sendUpdate = function(el){
  this.client.connector.updateElement(el);
}

Editor.prototype.showMenu = function(){
  var self = this,
    menu = [],
    obj = this.getSelectedObject();

  if(obj){
    menu.push({ text : 'Drag', onClick : 'onDrag' });
    menu.push({ text : 'Remove', onClick : 'onRemove' });
  }else{
    menu.push(
      { text : 'Add cube', onClick : 'onAddCube' }
    );
  }

  var div = $("<div />"),
    ul = $("<ul />").addClass("menu").appendTo(div);

  menu.forEach(function(item){
    $("<li />").text(item.text).click(function(){
      div.remove();
      self[item.onClick]();
    }).appendTo(ul);
  });

  this.client.renderOverlay(div);
}

Editor.prototype.startDragging = function(obj){
  var obj = this.getSelectedObject();

  this.selectionBox.object = obj;
  this.selectionBox.visible = true;
  this.selectionBox.update();

  this.client.requestPointerLock();

  this.dragging = true;
}

Editor.prototype.endDrag = function(){
  var obj = this.getSelectedObject();

  this.selectionBox.object = null;
  this.selectionBox.visible = false;
  this.selectionBox.update();

  this.dragging = false;
}

function snapToGrid(vector){
  var granularity = 0.1;
  return vector.multiplyScalar(1 / granularity).round().multiplyScalar(granularity);
}

Editor.prototype.onUpdate = function(controls){
  var obj = this.selectionBox.object;

  if(!obj){
    return;
  }

  var player = controls.getObject().position,
    direction = controls.getDirection(new THREE.Vector3),
    position = snapToGrid(player.clone().add(direction.multiplyScalar(2)));

  obj.position.copy(position);
  this.selectionBox.update();

  var el = obj.userData;
  el.attr("position", position.toArray().join(" "));
  this.sendUpdate(el);
}

module.exports = Editor;
