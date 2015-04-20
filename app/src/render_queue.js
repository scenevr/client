function RenderQueue () {
  this.queue = [];
  this.processing = false;
  this.interjobDelay = 5;
}

RenderQueue.prototype.clear = function () {
  // todo: cancel running job
  this.queue = [];
};

RenderQueue.prototype.add = function (job) {
  this.queue.push(job);

  if (!this.processing) {
    this.nextJob();
  }
};

RenderQueue.prototype.nextJob = function () {
  var job = this.queue.shift(),
    self = this;

  if (!job || this.processing) {
    return;
  }

  this.processing = true;

  job(function () {
    setTimeout(function () {
      self.processing = false;
      self.nextJob();
    }, self.interjobDelay);
  });
};

module.exports = RenderQueue;
