var exports = {
  Client: require('./src/client')
};

if (typeof window !== 'undefined') {
  window.Scene = exports;
} else {
  module.exports = exports;
}
