var THREE = require('three.js');
var MicrophoneReader = require('../vendor/voice/microphone-reader');
var WebAudioPlayer = require('../vendor/voice/web-audio-player');
var AudioEncoder = require('../vendor/voice/audio-encoder');
var AudioDecoder = require('../vendor/voice/audio-decoder');

class Voice{
  constructor (client) {
    this.client = client;

    this.period_size = 2048;
    this.delay_period_count = 4;
    this.ringbuffer_period_count = this.delay_period_count * 4;

    // Hardcoded for my PC in ff / chrome
    this.sampling_rate = 22050;
    this.num_of_channels = 2;

    this.opus_sampling_rate = 16000;
    this.opus_frame_duration = 60;

    this.ready = false;
  }

  setPositionAndOrientation (obj) {
    if (!this.player || !this.player.listener) {
      return;
    }

    this.player.listener.setPosition(obj.position.x, obj.position.y, obj.position.z);

    var v = obj.getWorldDirection(new THREE.Vector3(0, 0, 1));
    this.player.listener.setOrientation(-v.x, -v.y, -v.z, 0, 1, 0);
  }

  start () {
    this.player = new WebAudioPlayer();
    this.reader = new MicrophoneReader();

    if (!this.reader) {
      console.log('Couldnt create microphone');
      return;
    }

    this.working = false;
    this.packet_queue = [];
    this.encoder = new AudioEncoder('/vendor/opus_encoder.js');
    this.decoder = new AudioDecoder('/vendor/opus_decoder.js');

    // 8k: var header = [79, 112, 117, 115, 72, 101, 97, 100, 1, 2, 0, 0, 64, 31, 0, 0, 0, 0, 0];

    // 16k:
    var header = [79, 112, 117, 115, 72, 101, 97, 100, 1, 2, 0, 0, 128, 62, 0, 0, 0, 0, 0];
    var buffer = new ArrayBuffer(header.length);
    var view = new Uint8Array(buffer);

    for (var i = 0; i < header.length; i++) {
      view[i] = header[i];
    }

    this.decoder.setup({}, [{ data: buffer }]).then((info) => {
      console.log(info);

      this.player.init(info.sampling_rate, info.num_of_channels, this.period_size, this.delay_period_count, this.ringbuffer_period_count).then(() => {
        this.player.start();
        this.readyToRecieve = true;
        this.player.onneedbuffer = () => {
          console.log('buffer empty')
        };

      }, this.output_reject_log('player.init error'));
    }, this.output_reject_log('decoder.setup error'));
  }

  listen () {
    this.reader.open(this.period_size, {}).then((info) => {
      var enc_cfg = {
          sampling_rate: info.sampling_rate,
          num_of_channels: info.num_of_channels,
          params: {
              application: 2049, // Audio
              sampling_rate: this.opus_sampling_rate,
              frame_duration: this.opus_frame_duration
          }
      };

      console.log('Microphone info');
      console.log(info);

      this.encoder.setup(enc_cfg).then((packets) => {
        console.log('Encoder started');
        this.readyToTransmit = true;

        // var header = [];
        // var view = new Uint8Array(packets[0].data);
        // for (var i = 0; i < view.length; i++) {
        //   header[i] = view[i];
        // }
        // console.log(header.join(', '));

        setInterval(() => {
          this.reader.read().then((buf) => {
            this.client.debug.addEvent('encoder#encode', buf.samples.byteLength, 'bytes');

            this.encoder.encode(buf, (err, packets) => {
              if (err) {
                return;
              }

              if (packets.length === 0) {
                return;
              }

              this.client.debug.addEvent('voice#packetSend', packets[0].data.byteLength, 'bytes');
              this.sendSamples(packets[0].data);
              this.ready = true;
            });
          });
        }, this.opus_frame_duration);

      }, this.output_reject_log('encoder.setup error'));
    }, this.output_reject_log('open error'));
  }

  getSampleHeader () {
    var uuid = this.client.connector.uuid.replace(/-/g, '').split('');
    var header = new Uint8Array(18);

    header[0] = 0x50;
    header[1] = 0x00;

    for (var i = 0; i < 16; i++) {
      header[i + 2] = parseInt(uuid[i * 2 + 0], 16) * 16 + parseInt(uuid[i * 2 + 1], 16);
    }

    return header;
  }

  sendSamples (samples) {
    if (!this.client.connector) {
      return;
    }

    var header = this.getSampleHeader();

    var packet = new Uint8Array(header.byteLength + samples.byteLength);
    packet.set(header, 0);
    packet.set(new Uint8Array(samples), header.byteLength);

    this.client.connector.ws.send(packet);
  }

  enqueue (buffer) {
    if (!this.readyToRecieve) {
      return;
    }

    var view = new DataView(buffer);
    var uuid = '';

    if (view.getUint8(0) !== 0x50) {
      console.log('Bad packet');
      return;
    }

    for (var i = 0; i < 16; i++) {
      uuid += (Math.floor(view.getUint8(i + 2) / 16)).toString(16);
      uuid += (view.getUint8(i + 2) % 16).toString(16);

      if (i === 4 || i === 6 || i === 8 || i === 10) {
        uuid += '-';
      }
    }

    var player = client.connector.findPlayerByUUID(uuid);

    if (!player) {
      console.log('Could not find player');
      return;
    });

    if (!player.decoder) {

    }

    this.client.debug.addEvent('decoder#decode', buffer.byteLength, 'bytes');

    this.decoder.decode({data: buffer.slice(18) }).then((buf) => {
      this.client.debug.addEvent('decoder#decoded', buf.byteLength, 'bytes');
      this.player.enqueue(buf);
    });
  }

  close () {
    this.player.close();
  }

  output_reject_log (prefix) {
    return (e) => {
      this.close();
      console.error(prefix, e);
    };
  }
}

module.exports = Voice;
