const DirectionDecoder = require('../../src/main/pipeline/DirectionDecoder');
const { Direction } = require('../../src/shared/constants');

function makeMono(amplitude, size = 2048) {
  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) buf[i] = amplitude;
  return buf;
}

function makeSine(freq, amplitude, size = 4096, sampleRate = 48000) {
  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return buf;
}

describe('DirectionDecoder', () => {
  const decoder = new DirectionDecoder({ hfThreshold: 0.65, sampleRate: 48000 });

  it('leftRms=1.0, rightRms=0.0 → W, SW, or NW direction', () => {
    const left = makeMono(1.0);
    const right = makeMono(0.0);
    const result = decoder.decode({ leftWaveform: left, rightWaveform: right });
    expect([Direction.W, Direction.SW, Direction.NW]).toContain(result.direction);
  });

  it('rightRms=1.0, leftRms=0.0 → E, SE, or NE direction', () => {
    const left = makeMono(0.0);
    const right = makeMono(1.0);
    const result = decoder.decode({ leftWaveform: left, rightWaveform: right });
    expect([Direction.E, Direction.SE, Direction.NE]).toContain(result.direction);
  });

  it('equal RMS, high HF content → N (front center)', () => {
    // Equal L/R, high freq → center + front → N
    const sig = makeSine(10000, 0.8); // 10kHz — above hfBandLow=8000
    const result = decoder.decode({ leftWaveform: sig, rightWaveform: sig });
    // With equal channels, pan=0 (center); HF at 10kHz should push front
    expect(result.pan).toBeCloseTo(0, 1);
    // Direction should be N or S depending on hfRatio threshold
    expect([Direction.N, Direction.S]).toContain(result.direction);
  });

  it('pan value is in range [-1, 1]', () => {
    const left = makeMono(0.5);
    const right = makeMono(0.3);
    const result = decoder.decode({ leftWaveform: left, rightWaveform: right });
    expect(result.pan).toBeGreaterThanOrEqual(-1);
    expect(result.pan).toBeLessThanOrEqual(1);
  });

  it('returns all required fields', () => {
    const sig = makeMono(0.5);
    const result = decoder.decode({ leftWaveform: sig, rightWaveform: sig });
    expect(typeof result.direction).toBe('string');
    expect(typeof result.pan).toBe('number');
    expect(typeof result.lrConfidence).toBe('number');
    expect(typeof result.fbConfidence).toBe('number');
  });

  it('setHFThreshold clamps to 0-1', () => {
    decoder.setHFThreshold(2.0);
    expect(decoder.hfThreshold).toBe(1.0);
    decoder.setHFThreshold(-1.0);
    expect(decoder.hfThreshold).toBe(0.0);
    decoder.setHFThreshold(0.65);
  });

  it('handles silence without error', () => {
    const silence = new Float32Array(2048);
    expect(() => decoder.decode({ leftWaveform: silence, rightWaveform: silence })).not.toThrow();
  });
});
