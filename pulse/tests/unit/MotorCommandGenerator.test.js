const MotorCommandGenerator = require('../../src/main/pipeline/MotorCommandGenerator');
const { Direction, EventCategory } = require('../../src/shared/constants');

function makeEvent(direction, category = EventCategory.GUNSHOT, intensityRms = 1.0) {
  return {
    id: 'test-1',
    direction,
    category,
    confidence: 0.9,
    intensityRms,
    priority: 1,
    timestamp: Date.now(),
  };
}

describe('MotorCommandGenerator', () => {
  const gen = new MotorCommandGenerator();

  it('Direction.N → motor N ≈ 255, others ≈ 0', () => {
    const cmd = gen.generate(makeEvent(Direction.N));
    expect(cmd.motors.N).toBeGreaterThan(200);
    expect(cmd.motors.S).toBeLessThan(10);
    expect(cmd.motors.E).toBeLessThan(10);
    expect(cmd.motors.W).toBeLessThan(10);
  });

  it('Direction.S → motor S ≈ 255, N ≈ 0', () => {
    const cmd = gen.generate(makeEvent(Direction.S));
    expect(cmd.motors.S).toBeGreaterThan(200);
    expect(cmd.motors.N).toBeLessThan(10);
  });

  it('Direction.E → motor E ≈ 255, W ≈ 0', () => {
    const cmd = gen.generate(makeEvent(Direction.E));
    expect(cmd.motors.E).toBeGreaterThan(200);
    expect(cmd.motors.W).toBeLessThan(10);
  });

  it('Direction.W → motor W ≈ 255, E ≈ 0', () => {
    const cmd = gen.generate(makeEvent(Direction.W));
    expect(cmd.motors.W).toBeGreaterThan(200);
    expect(cmd.motors.E).toBeLessThan(10);
  });

  it('Direction.NE → N and E both ≈ 181 (cos45°*255)', () => {
    const cmd = gen.generate(makeEvent(Direction.NE));
    const expected = Math.round(Math.cos(Math.PI / 4) * 255);
    expect(cmd.motors.N).toBeCloseTo(expected, -1); // within ~10
    expect(cmd.motors.E).toBeCloseTo(expected, -1);
    expect(cmd.motors.S).toBeLessThan(10);
    expect(cmd.motors.W).toBeLessThan(10);
  });

  it('low intensityRms → lower motor values', () => {
    const cmdLow = gen.generate(makeEvent(Direction.N, EventCategory.GUNSHOT, 0.01));
    const cmdHigh = gen.generate(makeEvent(Direction.N, EventCategory.GUNSHOT, 1.0));
    expect(cmdLow.motors.N).toBeLessThan(cmdHigh.motors.N);
  });

  it('generatePacket returns 8-byte Buffer with valid checksum', () => {
    const cmd = gen.generate(makeEvent(Direction.N));
    const pkt = gen.generatePacket(cmd);
    expect(pkt).toBeInstanceOf(Buffer);
    expect(pkt.length).toBe(8);
    let xor = 0;
    for (let i = 0; i < 7; i++) xor ^= pkt[i];
    expect(pkt[7]).toBe(xor);
  });

  it('setWaveformOverride applies custom waveform', () => {
    const g = new MotorCommandGenerator();
    g.setWaveformOverride(EventCategory.GUNSHOT, { id: 'EXPLOSION', durationMs: 999 });
    const cmd = g.generate(makeEvent(Direction.N, EventCategory.GUNSHOT));
    expect(cmd.waveform).toBe('EXPLOSION');
    expect(cmd.durationMs).toBe(999);
  });

  it('motor values are in range 0-255', () => {
    for (const dir of Object.values(Direction)) {
      const cmd = gen.generate(makeEvent(dir));
      for (const v of Object.values(cmd.motors)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});
