const SourceSeparator = require('../../src/main/pipeline/SourceSeparator');

function makeAudioBuffer(size = 4096) {
  const left = new Float32Array(size);
  const right = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    left[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5;
    right[i] = Math.sin(2 * Math.PI * 880 * i / 48000) * 0.3;
  }
  return { left, right, sampleRate: 48000, timestamp: Date.now() };
}

describe('SourceSeparator (NMF fallback)', () => {
  it('returns 1-3 SourceStream objects', async () => {
    const sep = new SourceSeparator({ maxSources: 3, useOnnx: false });
    await sep.init();
    const buf = makeAudioBuffer(4096);
    const sources = sep.process(buf);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources.length).toBeLessThanOrEqual(3);
  });

  it('each source has correct Float32Array fields', async () => {
    const sep = new SourceSeparator({ maxSources: 2, useOnnx: false });
    await sep.init();
    const buf = makeAudioBuffer(4096);
    const sources = sep.process(buf);
    for (const src of sources) {
      expect(src.leftWaveform).toBeInstanceOf(Float32Array);
      expect(src.rightWaveform).toBeInstanceOf(Float32Array);
      expect(typeof src.sourceIndex).toBe('number');
      expect(src.leftWaveform.length).toBeGreaterThan(0);
      expect(src.rightWaveform.length).toBeGreaterThan(0);
    }
  });

  it('handles short buffer gracefully', async () => {
    const sep = new SourceSeparator({ maxSources: 2, useOnnx: false });
    await sep.init();
    const buf = { left: new Float32Array(64), right: new Float32Array(64), sampleRate: 48000, timestamp: Date.now() };
    expect(() => sep.process(buf)).not.toThrow();
    const sources = sep.process(buf);
    expect(sources.length).toBeGreaterThanOrEqual(1);
  });

  it('handles silence gracefully', async () => {
    const sep = new SourceSeparator({ maxSources: 2, useOnnx: false });
    await sep.init();
    const buf = { left: new Float32Array(4096), right: new Float32Array(4096), sampleRate: 48000, timestamp: Date.now() };
    const sources = sep.process(buf);
    expect(sources.length).toBeGreaterThanOrEqual(1);
  });
});
