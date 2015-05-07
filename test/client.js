var Client = require('../src/client');
var tape = require('tape');

var dom = document.createElement('canvas');
var c = new Client(dom);

tape('create', function (t) {
  t.ok(c);
  t.end();
});
