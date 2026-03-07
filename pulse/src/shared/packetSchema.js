const WAVEFORM_IDS = {
  GUNSHOT:   0x00,
  FOOTSTEP:  0x01,
  EXPLOSION: 0x02,
  ABILITY:   0x03,
  ALERT:     0x04,
  RELOAD:    0x05,
  UNKNOWN:   0x04,
  STOP:      0xFF,
};

/**
 * Build an 8-byte binary packet from a MotorCommand.
 * Byte layout:
 *   0: Motor N intensity (uint8)
 *   1: Motor E intensity (uint8)
 *   2: Motor S intensity (uint8)
 *   3: Motor W intensity (uint8)
 *   4: Waveform ID (uint8)
 *   5: Duration high byte
 *   6: Duration low byte
 *   7: XOR checksum of bytes 0-6
 *
 * @param {{ motors: {N:number,E:number,S:number,W:number}, waveform: string, durationMs: number }} command
 * @returns {Buffer}
 */
function buildPacket(command) {
  const { motors, waveform, durationMs } = command;
  const buf = Buffer.alloc(8);
  buf[0] = Math.round(Math.max(0, Math.min(255, motors.N || 0)));
  buf[1] = Math.round(Math.max(0, Math.min(255, motors.E || 0)));
  buf[2] = Math.round(Math.max(0, Math.min(255, motors.S || 0)));
  buf[3] = Math.round(Math.max(0, Math.min(255, motors.W || 0)));
  buf[4] = WAVEFORM_IDS[waveform] !== undefined ? WAVEFORM_IDS[waveform] : 0x04;
  const dur = Math.max(0, Math.min(65535, Math.round(durationMs || 0)));
  buf[5] = (dur >> 8) & 0xFF;
  buf[6] = dur & 0xFF;
  buf[7] = buf[0] ^ buf[1] ^ buf[2] ^ buf[3] ^ buf[4] ^ buf[5] ^ buf[6];
  return buf;
}

/**
 * Verify checksum of a received 8-byte packet.
 * @param {Buffer} packet
 * @returns {boolean}
 */
function verifyPacket(packet) {
  if (!packet || packet.length !== 8) return false;
  let xor = 0;
  for (let i = 0; i < 7; i++) xor ^= packet[i];
  return xor === packet[7];
}

module.exports = { buildPacket, verifyPacket, WAVEFORM_IDS };
