/* globals performance */

class DebugStats {
  constructor (client) {
    this.client = client;
    this.dict = { debug: 'enabled' };
    this.perSecond = {};
    this.create();

    setInterval(() => {
      this.update();
    }, 1000);
  }

  create () {
    this.el = document.createElement('div');
    this.el.style.cssText = 'position: absolute; background: rgba(0,0,0,0.8); color: white; top: 10px; right: 70px; border-radius: 5px; max-width: 480px; padding: 8px; z-index: 100000';
    document.body.appendChild(this.el);
  }

  set (key, value) {
    this.dict[key] = value;
  }

  addEvent (key, value, unit) {
    if (!unit) {
      unit = 'hz';
    }

    if (!this.perSecond[key]) {
      this.perSecond[key] = [];
    }

    this.perSecond[key].push({
      t: performance.now(),
      v: value
    });

    this.perSecond[key] = this.perSecond[key].filter((f) => {
      return (performance.now() - f.t) < 1000;
    });
  }

  updateEvents () {
    Object.keys(this.perSecond).forEach((key) => {
      var r = 0;

      this.perSecond[key].forEach((sample) => {
        if (sample.v) {
          r += sample.v;
        } else {
          r++;
        }
      });

      this.set(key, r);
    });
  }

  update () {
    if (!this.client.options.debug) {
      this.el.style.display = 'none';
    } else {
      this.el.style.display = 'block';

      this.updateEvents();

      var html = ['<dl>'];

      Object.keys(this.dict).forEach((key) => {
        html.push('<dt>' + key + '</dt><dd>' + this.dict[key] + '</dd>');
      });

      html.push('</dl>');

      this.el.innerHTML = html.join('');
    }
  }
}

module.exports = DebugStats;
