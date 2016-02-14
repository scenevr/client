/* globals Worker */

var RingBuffer = require('./ring-buffer');

function WebAudioPlayer() {
    this.in_writing = false;
    this.buffering = true;
    this.onneedbuffer = null;
    this.in_requesting_check_buffer = false;
}
WebAudioPlayer.prototype.init = function (sampling_rate, num_of_channels, period_samples, delay_periods, buffer_periods) {
    var _this = this;
    return new Promise(function (resolve, reject) {
        _this.context = new AudioContext();
        _this.node = _this.context.createScriptProcessor(period_samples, 0, num_of_channels);
        _this.node.onaudioprocess = function (ev) {
            _this._onaudioprocess(ev);
        };
        if (sampling_rate != _this.getActualSamplingRate()) {
            console.log('enable resampling: ' + sampling_rate + ' -> ' + _this.getActualSamplingRate());
            _this.period_samples = Math.ceil(period_samples * _this.getActualSamplingRate() / sampling_rate) * num_of_channels;
            _this.resampler = new Worker('/vendor/resampler.js');
        }
        else {
            _this.period_samples = period_samples * num_of_channels;
        }
        _this.ringbuf = new RingBuffer(new Float32Array(_this.period_samples * buffer_periods));
        _this.delay_samples = _this.period_samples * delay_periods;
        if (_this.resampler) {
            _this.resampler.onmessage = function (ev) {
                if (ev.data.status == 0) {
                    resolve();
                }
                else {
                    reject(ev.data);
                }
            };
            _this.resampler.postMessage({
                channels: num_of_channels,
                in_sampling_rate: sampling_rate,
                out_sampling_rate: _this.getActualSamplingRate()
            });
        }
        else {
            resolve();
        }
    });
};
WebAudioPlayer.prototype.enqueue = function (buf) {
    var _this = this;
    return new Promise(function (resolve, reject) {
        if (_this.in_writing) {
            reject();
            return;
        }
        _this.in_writing = true;
        var func = function (data) {
            _this.ringbuf.append(data).then(function () {
                _this.in_writing = false;
                _this.check_buffer();
            }, function (e) {
                _this.in_writing = false;
                reject(e);
            });
        };
        if (_this.resampler) {
            var transfer_list = buf.transferable ? [buf.samples.buffer] : [];
            _this.resampler.onmessage = function (ev) {
                if (ev.data.status != 0) {
                    _this.in_writing = false;
                    reject(ev.data);
                    return;
                }
                func(ev.data.result);
            };
            _this.resampler.postMessage({
                samples: buf.samples
            }, transfer_list);
        }
        else {
            func(buf.samples);
        }
    });
};
WebAudioPlayer.prototype._onaudioprocess = function (ev) {
    if (this.buffering) {
        this.check_buffer();
        return;
    }
    var N = ev.outputBuffer.numberOfChannels;
    var buf = new Float32Array(ev.outputBuffer.getChannelData(0).length * N);
    var size = this.ringbuf.read_some(buf) / N;
    for (var i = 0; i < N; ++i) {
        var ch = ev.outputBuffer.getChannelData(i);
        for (var j = 0; j < size; ++j)
            ch[j] = buf[j * N + i];
    }
    this.check_buffer(true);
};
WebAudioPlayer.prototype.check_buffer = function (useTimeOut) {
    var _this = this;
    if (useTimeOut === void 0) { useTimeOut = false; }
    if (this.in_requesting_check_buffer || !this.onneedbuffer)
        return;
    var needbuf = this.check_buffer_internal();
    if (!needbuf)
        return;
    if (useTimeOut) {
        this.in_requesting_check_buffer = true;
        window.setTimeout(function () {
            _this.in_requesting_check_buffer = false;
            if (_this.check_buffer_internal())
                _this.onneedbuffer();
        }, 0);
    }
    else {
        this.onneedbuffer();
    }
};
WebAudioPlayer.prototype.check_buffer_internal = function () {
    if (this.in_writing)
        return false;
    var avail = this.ringbuf.available();
    var size = this.ringbuf.size();
    if (size >= this.delay_samples)
        this.buffering = false;
    if (this.period_samples <= avail)
        return true;
    return false;
};
WebAudioPlayer.prototype.start = function () {
    if (this.node) {
        var panner = this.context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;
        panner.setOrientation(1, 0, 0);
        // panner.setPosition(500, 0, 0);
        this.panner = panner;

        this.listener = this.context.listener;
        this.listener.setOrientation(0, 0, -1, 0, 1, 0);
        this.listener.setPosition(0, 0, 0);

        this.node.connect(panner);
        panner.connect(this.context.destination);
    }
};
WebAudioPlayer.prototype.stop = function () {
    if (this.node) {
        this.ringbuf.clear();
        this.buffering = true;
        this.node.disconnect();
    }
};
WebAudioPlayer.prototype.close = function () {
    this.stop();
    this.context = null;
    this.node = null;
};
WebAudioPlayer.prototype.getActualSamplingRate = function () {
    return this.context.sampleRate;
};
WebAudioPlayer.prototype.getBufferStatus = function () {
    return {
        delay: this.ringbuf.size(),
        available: this.ringbuf.available(),
        capacity: this.ringbuf.capacity()
    };
};

module.exports = WebAudioPlayer;
