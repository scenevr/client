var THREE = require('three.js');
var MicrophoneReader = require('../vendor/voice/microphone-reader');
var WebAudioPlayer = require('../vendor/voice/web-audio-player');
var AudioEncoder = require('../vendor/voice/audio-encoder');
var AudioDecoder = require('../vendor/voice/audio-decoder');

class Voice{
  constructor (client) {
    this.client = client;

    this.period_size = 1024;
    this.delay_period_count = 4;
    this.ringbuffer_period_count = this.delay_period_count * 4;

    this.sampling_rate = 16000;
    this.num_of_channels = 1;
    this.opus_sampling_rate = 16000;
    this.opus_frame_duration = 60;
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

    var open_params = {
      sampling_rate: this.sampling_rate,
      num_of_channels: this.num_of_channels
    };

    this.reader.open(this.period_size, open_params).then((info) => {
      var enc_cfg = {
          sampling_rate: info.sampling_rate,
          num_of_channels: info.num_of_channels,
          params: {
              application: 2048, // VOIP
              sampling_rate: this.opus_sampling_rate,
              frame_duration: this.opus_frame_duration
          }
      };

      this.encoder.setup(enc_cfg).then((packets) => {
        this.decoder.setup({}, packets).then((info) => {
          this.player.init(info.sampling_rate, info.num_of_channels, this.period_size, this.delay_period_count, this.ringbuffer_period_count).then(() => {
            this.player.start();

            window.setInterval(() => {
              this.client.debug.set('buffer stats', JSON.stringify(this.player.getBufferStatus()));
            }, 1000);
          }, this.output_reject_log('player.init error'));
        }, this.output_reject_log('decoder.setup error'));
      }, this.output_reject_log('encoder.setup error'));
    }, this.output_reject_log('open error'));

    this.player.onneedbuffer = () => {
      if (this.reader.in_flight || this.working) {
        return;
      }
      this.working = true;
      if (this.packet_queue.length > 0) {
        var packet = this.packet_queue.shift();

        this.decoder.decode(packet).then((buf) => {
          this.player.enqueue(buf);
          this.working = false;
        });
      } else {
        this.reader.read().then((buf) => {
          this.encoder.encode(buf).then((packets) => {
            if (packets.length === 0) {
              this.working = false;
              return;
            }

            // this.client.connector.ws.send(packets[0].data);
            console.log('Sent voice packet');
            // this.client.debug.addEvent('Sent voice packet');

            // if its not keeping up well we're fucked aren't we?

            // for (var i = 1; i < packets.length; ++i) {
            //   this.packet_queue.push(packets[i]);
            // }

            // this.decoder.decode(packets[0]).then((buf) => {
            //   this.player.enqueue(buf);
            //   this.working = false;
            // });
          });
        });
      }
    };
  }

  enqueue (data) {
    this.client.debug.addEvent('Recieved voice packet');
    this.decoder.decode({data: data }).then((buf) => {
      this.player.enqueue(buf);
      this.working = false;
    });
  }

  output_reject_log (message) {
    console.error(message);
  }

  startLoopback () {
    this.player = new WebAudioPlayer();
    this.reader = new MicrophoneReader();

    if (!this.reader) {
      console.log('Couldnt create microphone');
      return;
    }

    this.reader.open(this.period_size, {}).then((info) => {
      this.player.onneedbuffer = () => {
        if (this.reader.in_flight) {
          return;
        }

        this.reader.read().then((buf) => {
          this.player.enqueue(buf).catch(() => {
            console.log('ringbuf enqueue error?');
          });
        }, (e) => {
          console.log('reader.read error');
          console.error(e);
        });
      };
    });

    this.player.init(
      this.sampling_rate, this.num_of_channels, this.period_size, this.delay_period_count, this.ringbuffer_period_count
    ).then(() => {
      this.player.start();

      window.setInterval(() => {
        console.log(this.player.getBufferStatus());
      }, 1000);
    });
  }
}

module.exports = Voice;
