const { DIRECTION_DEGREES, EventCategory } = require('../../shared/constants');
const { buildPacket } = require('../../shared/packetSchema');

const WAVEFORM_DEFAULTS = {
  [EventCategory.GUNSHOT]:   { id: 'GUNSHOT',   durationMs: 30  },
  [EventCategory.FOOTSTEP]:  { id: 'FOOTSTEP',  durationMs: 60  },
  [EventCategory.EXPLOSION]: { id: 'EXPLOSION', durationMs: 400 },
  [EventCategory.ABILITY]:   { id: 'ABILITY',   durationMs: 120 },
  [EventCategory.ALERT]:     { id: 'ALERT',     durationMs: 200 },
  [EventCategory.RELOAD]:    { id: 'RELOAD',    durationMs: 160 },
  [EventCategory.UNKNOWN]:   { id: 'ALERT',     durationMs: 200 },
};

class MotorCommandGenerator {
  /**
   * @param {{ waveformOverrides?: Object }} opts
   */
  constructor({ waveformOverrides = {} } = {}) {
    this._waveformOverrides = { ...waveformOverrides };
  }

  /**
   * Generate a MotorCommand from an AudioEvent.
   * @param {Object} event AudioEvent
   * @returns {{ motors: {N:number,E:number,S:number,W:number}, waveform: string, durationMs: number, intensityScale: number, timestamp: number }}
   */
  generate(event) {
    const deg = DIRECTION_DEGREES[event.direction] || 0;
    const rad = (deg * Math.PI) / 180;

    // Step 1 — cosine blend
    const N = Math.max(0, Math.cos(rad));
    const E = Math.max(0, Math.cos(rad - Math.PI / 2));
    const S = Math.max(0, Math.cos(rad - Math.PI));
    const W = Math.max(0, Math.cos(rad - (3 * Math.PI) / 2));

    // Step 2 — intensity scaling (log scale)
    let scale = Math.log10(1 + 9 * (event.intensityRms || 0));
    scale = Math.max(0.1, Math.min(1.0, scale));

    // Step 3 — pack to uint8
    const motors = {
      N: Math.round(N * scale * 255),
      E: Math.round(E * scale * 255),
      S: Math.round(S * scale * 255),
      W: Math.round(W * scale * 255),
    };

    // Step 4 — waveform lookup
    const override = this._waveformOverrides[event.category];
    const defaults = WAVEFORM_DEFAULTS[event.category] || WAVEFORM_DEFAULTS[EventCategory.UNKNOWN];
    const waveform = override ? override.id : defaults.id;
    const durationMs = override ? override.durationMs : defaults.durationMs;

    return {
      motors,
      waveform,
      durationMs,
      intensityScale: scale,
      timestamp: event.timestamp || Date.now(),
    };
  }

  /**
   * Build 8-byte binary packet from a MotorCommand.
   * @param {Object} command MotorCommand
   * @returns {Buffer}
   */
  generatePacket(command) {
    return buildPacket(command);
  }

  /**
   * Override waveform for a given event category.
   * @param {string} category EventCategory
   * @param {Object} waveform { id: string, durationMs: number }
   */
  setWaveformOverride(category, waveform) {
    this._waveformOverrides[category] = waveform;
  }
}

module.exports = MotorCommandGenerator;
