const { parseStringPromise, processors } = require('xml2js');

class SonosPlaybackService {
  constructor(musicPlayback, { readState, now = () => Date.now(), setIntervalImpl = setInterval, clearIntervalImpl = clearInterval }) {
    this.musicPlayback = musicPlayback;
    this.readState = readState;
    this.now = now;
    this.setInterval = setIntervalImpl;
    this.clearInterval = clearIntervalImpl;
    this.devices = new Map();
  }

  static async parseState(transportXml, positionXml) {
    const options = { explicitArray: false, tagNameProcessors: [processors.stripPrefix] };
    const [transport, position] = await Promise.all([parseStringPromise(transportXml, options), parseStringPromise(positionXml, options)]);
    const transportInfo = transport.Envelope.Body.GetTransportInfoResponse;
    const positionInfo = position.Envelope.Body.GetPositionInfoResponse;
    const milliseconds = value => {
      const match = String(value || '').match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
      return match ? (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 : null;
    };
    return {
      state: transportInfo.CurrentTransportState,
      trackUri: positionInfo.TrackURI || null,
      duration: positionInfo.TrackDuration || null,
      position: positionInfo.RelTime || null,
      durationMs: milliseconds(positionInfo.TrackDuration),
      positionMs: milliseconds(positionInfo.RelTime)
    };
  }

  start(device, track, expectedUri = null) {
    const previous = this.devices.get(device.uuid);
    if (previous) this.clearInterval(previous.timer);
    const playback = { device, track, expectedUri, positionMs: 0, durationMs: track.duration || null, playing: true, recorded: false, request: null, polling: false, startedAt: this.now() };
    this.devices.set(device.uuid, playback);
    this.publish(playback);
    playback.timer = this.setInterval(async () => {
      if (playback.polling) return;
      playback.polling = true;
      try {
        const state = await this.readState(device);
        if (this.devices.get(device.uuid) === playback) await this.observe(device.uuid, state);
      } catch {
      } finally {
        playback.polling = false;
      }
    }, 3000);
    playback.timer?.unref?.();
  }

  publish(playback) {
    this.musicPlayback.updatePlayback(`sonos:${playback.device.uuid}`, playback.track, playback.playing, { source: 'sonos', appName: playback.device.name });
  }

  async observe(deviceId, { state, positionMs, durationMs, trackUri }) {
    const playback = this.devices.get(deviceId);
    if (!playback) return;
    if (state === 'PLAYING' && trackUri && playback.expectedUri && trackUri !== playback.expectedUri && this.now() - playback.startedAt > 4000) {
      this.clearInterval(playback.timer);
      this.devices.delete(deviceId);
      this.musicPlayback.updatePlayback(`sonos:${deviceId}`, null, false);
      return;
    }
    if (durationMs > 0) playback.durationMs = durationMs;
    if (positionMs >= 0) playback.positionMs = Math.max(playback.positionMs, positionMs);
    if (state === 'PLAYING') {
      playback.playing = true;
      this.publish(playback);
    } else if (state === 'PAUSED_PLAYBACK') {
      playback.playing = false;
      this.publish(playback);
    } else if ((state === 'STOPPED' || state === 'NO_MEDIA_PRESENT') && this.now() - playback.startedAt > 4000) {
      if (playback.durationMs > 0 && playback.positionMs >= playback.durationMs * 0.9) {
        if (!playback.recorded && !playback.request && playback.track.ratingKey) {
          playback.request = this.musicPlayback.recordPlay(playback.track.ratingKey).then(() => {
            playback.recorded = true;
          }).catch(error => {
            playback.request = null;
            throw error;
          });
        }
        if (playback.request) await playback.request;
      }
      if (this.devices.get(deviceId) !== playback) return;
      this.clearInterval(playback.timer);
      this.devices.delete(deviceId);
      this.musicPlayback.updatePlayback(`sonos:${deviceId}`, null, false);
    }
  }

  async control(deviceId, action) {
    const playback = this.devices.get(deviceId);
    if (!playback) return;
    if (action === 'play' || action === 'pause') {
      playback.playing = action === 'play';
      this.publish(playback);
    } else if (action === 'stop') {
      playback.startedAt = 0;
      await this.observe(deviceId, { state: 'STOPPED' });
    }
  }
}

module.exports = SonosPlaybackService;