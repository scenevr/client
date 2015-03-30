'use strict';

function Environment(){
}

Environment.prototype.isMobile = function(){
  return !!(/Android|iPhone|iPad|iPod|IEMobile/i.test(navigator.userAgent));
}

Environment.prototype.physicsHertz = function(){
  return 60.0;
}

Environment.prototype.isDebug = function(){
  return false;
}

// Render at a reduced framerate (are you developing the client on the plane to sydney? you want this)
Environment.prototype.isLowPowerMode = function(){
  return false;
}

// Feature flag
Environment.prototype.isEditingEnabled = function(){
  return false;
}

// unpublish after 90 seconds of inactivity
Environment.prototype.unpublishTimeout = function(){
  return 90 * 1000;
}

module.exports = new Environment;