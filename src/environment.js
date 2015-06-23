function Environment () {
}

// Amount of time profiling will run for
Environment.prototype.getProfilePeriod = function () {
  return 0.5;
};

Environment.prototype.getBaseUrl = function () {
  // You must serve image assets
  return '';
};

Environment.prototype.getWalkSpeed = function () {
  return 2.5;
};

Environment.prototype.getRunSpeed = function () {
  return 5.0;
};

Environment.prototype.getJumpImpulse = function () {
  return 8.0;
};

Environment.prototype.updateHertz = function () {
  return 10;
};

Environment.prototype.isMobile = function () {
  return !!(/Android|iPhone|iPad|iPod|IEMobile/i.test(navigator.userAgent));
};

Environment.prototype.physicsHertz = function () {
  return 60.0;
};

Environment.prototype.isDebug = function () {
  return false;
};

// Render at a reduced framerate (are you developing the client on the plane to sydney? you want this)
Environment.prototype.isLowPowerMode = function () {
  return false;
};

// unpublish after 90 seconds of inactivity
Environment.prototype.unpublishTimeout = function () {
  return 90 * 1000;
};

// degrees
Environment.prototype.getViewAngle = function () {
  return 60;
};

// Near and far clipping panes in meters
Environment.prototype.getNear = function () {
  return 0.1;
};

Environment.prototype.getFar = function () {
  return 5000;
};

module.exports = new Environment();
