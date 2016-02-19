var RingBuffer = require('./ring-buffer');

function MicrophoneReader() {
}
MicrophoneReader.prototype.open = function (buffer_samples_per_ch, params) {
    var _this = this;
    this.context = new AudioContext();
    return new Promise(function (resolve, reject) {
        var callback = function (strm) {
            _this.src_node = _this.context.createMediaStreamSource(strm);
            _this.ringbuf = new RingBuffer(new Float32Array(buffer_samples_per_ch * _this.src_node.channelCount * 8));
            _this.proc_node = _this.context.createScriptProcessor(0, 1, _this.src_node.channelCount);
            _this.proc_node.onaudioprocess = function (ev) {
                _this._onaudioprocess(ev);
            };
            _this.src_node.connect(_this.proc_node);
            _this.proc_node.connect(_this.context.destination);
            _this.read_unit = buffer_samples_per_ch * _this.src_node.channelCount;
            resolve({
                sampling_rate: _this.context.sampleRate / 2,
                num_of_channels: _this.src_node.channelCount
            });
        };
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            }).then(callback, reject);
        }
        else {
            navigator.getUserMedia = (navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia);
            navigator.getUserMedia({
                audio: true,
                video: false
            }, callback, reject);
        }
    });
};
MicrophoneReader.prototype._onaudioprocess = function (ev) {
    var num_of_ch = ev.inputBuffer.numberOfChannels;
    var samples_per_ch = ev.inputBuffer.getChannelData(0).length;
    var data = new Float32Array(num_of_ch * samples_per_ch);
    for (var i = 0; i < num_of_ch; ++i) {
        var ch = ev.inputBuffer.getChannelData(i);
        for (var j = 0; j < samples_per_ch; ++j)
            data[j * num_of_ch + i] = ch[j];
    }
    this.ringbuf.append(data);
};
MicrophoneReader.prototype.read = function () {
    var _this = this;
    this.in_flight = true;
    return new Promise(function (resolve, reject) {
        var buf = new Float32Array(_this.read_unit);
        var func = function () {
            var size = _this.ringbuf.read_some(buf);
            if (size == 0) {
                window.setTimeout(function () {
                    func();
                }, 10);
                return;
            }
            _this.in_flight = false;
            resolve({
                timestamp: 0,
                samples: buf.subarray(0, size),
                transferable: true
            });
        };
        func();
    });
};

MicrophoneReader.prototype.close = function () {
};

module.exports = MicrophoneReader;
