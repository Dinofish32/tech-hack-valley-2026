const { buildPacket, verifyPacket, WAVEFORM_IDS } = require('../../src/shared/packetSchema');

describe('buildPacket', () => {
  it('produces an 8-byte Buffer', () => {
    const cmd = { motors: { N: 255, E: 0, S: 0, W: 0 }, waveform: 'GUNSHOT', durationMs: 30 };
    const pkt = buildPacket(cmd);
    expect(pkt).toBeInstanceOf(Buffer);
    expect(pkt.length).toBe(8);
  });

  it('sets motor bytes correctly', () => {
    const cmd = { motors: { N: 128, E: 64, S: 32, W: 16 }, waveform: 'FOOTSTEP', durationMs: 100 };
    const pkt = buildPacket(cmd);
    expect(pkt[0]).toBe(128);
    expect(pkt[1]).toBe(64);
    expect(pkt[2]).toBe(32);
    expect(pkt[3]).toBe(16);
  });

  it('sets correct waveform ID for GUNSHOT', () => {
    const cmd = { motors: { N: 0, E: 0, S: 0, W: 0 }, waveform: 'GUNSHOT', durationMs: 30 };
    const pkt = buildPacket(cmd);
    expect(pkt[4]).toBe(0x00);
  });

  it('encodes duration across bytes 5 and 6', () => {
    const durationMs = 500; // 0x01F4
    const cmd = { motors: { N: 0, E: 0, S: 0, W: 0 }, waveform: 'ALERT', durationMs };
    const pkt = buildPacket(cmd);
    expect(pkt[5]).toBe(0x01);
    expect(pkt[6]).toBe(0xF4);
  });

  it('produces correct XOR checksum', () => {
    const cmd = { motors: { N: 200, E: 100, S: 50, W: 25 }, waveform: 'EXPLOSION', durationMs: 300 };
    const pkt = buildPacket(cmd);
    let xor = 0;
    for (let i = 0; i < 7; i++) xor ^= pkt[i];
    expect(pkt[7]).toBe(xor);
  });

  it('passes verifyPacket', () => {
    const cmd = { motors: { N: 180, E: 90, S: 45, W: 22 }, waveform: 'FOOTSTEP', durationMs: 80 };
    const pkt = buildPacket(cmd);
    expect(verifyPacket(pkt)).toBe(true);
  });

  it('verifyPacket rejects tampered packet', () => {
    const cmd = { motors: { N: 100, E: 0, S: 0, W: 0 }, waveform: 'GUNSHOT', durationMs: 30 };
    const pkt = buildPacket(cmd);
    pkt[0] = pkt[0] ^ 0xFF; // corrupt byte 0
    expect(verifyPacket(pkt)).toBe(false);
  });

  it('clamps motor values to 0-255', () => {
    const cmd = { motors: { N: 999, E: -5, S: 128, W: 0 }, waveform: 'ALERT', durationMs: 200 };
    const pkt = buildPacket(cmd);
    expect(pkt[0]).toBe(255);
    expect(pkt[1]).toBe(0);
  });
});
