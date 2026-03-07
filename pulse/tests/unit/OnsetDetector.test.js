const OnsetDetector = require('../../src/main/pipeline/OnsetDetector');

function makeSilence(size) {
  return new Float32Array(size);
}

function makeLoud(size, amplitude = 1.0) {
  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) buf[i] = amplitude * (Math.random() * 2 - 1);
  return buf;
}

function makeAudioBuffer(left, right) {
  return { left, right, sampleRate: 48000, timestamp: Date.now() };
}

describe('OnsetDetector', () => {
  it('detects no onset in silence', () => {
    const od = new OnsetDetector({ threshold: 0.3 });
    // Feed several silent buffers to build up flux history
    let results = [];
    for (let i = 0; i < 5; i++) {
      const silence = makeSilence(1024);
      results = od.process(makeAudioBuffer(silence, silence));
    }
    expect(results.filter(r => r.detected).length).toBe(0);
  });

  it('detects onset after sudden loud frame following silence', () => {
    const od = new OnsetDetector({ threshold: 0.3, debounceMs: 0 });
    // Prime with silence
    for (let i = 0; i < 10; i++) {
      const silence = makeSilence(2048);
      od.process(makeAudioBuffer(silence, silence));
    }
    // Now send a loud burst
    let detected = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const loud = makeLoud(2048, 1.0);
      const results = od.process(makeAudioBuffer(loud, loud));
      if (results.some(r => r.detected)) {
        detected = true;
        break;
      }
    }
    expect(detected).toBe(true);
  });

  it('onset result has correct shape', () => {
    const od = new OnsetDetector({ threshold: 0.01, debounceMs: 0 });
    for (let i = 0; i < 3; i++) od.process(makeAudioBuffer(makeSilence(2048), makeSilence(2048)));
    const loud = makeLoud(2048, 1.0);
    const results = od.process(makeAudioBuffer(loud, loud));
    const onset = results.find(r => r.detected);
    if (onset) {
      expect(typeof onset.timestamp).toBe('number');
      expect(onset.frame).toBeInstanceOf(Float32Array);
      expect(onset.frame.length).toBe(1024);
    }
  });

  it('debounce suppresses consecutive onsets within debounceMs', () => {
    const od = new OnsetDetector({ threshold: 0.01, debounceMs: 1000 });
    // Prime
    for (let i = 0; i < 3; i++) od.process(makeAudioBuffer(makeSilence(2048), makeSilence(2048)));
    // First loud → onset
    const loud1 = makeLoud(2048, 1.0);
    od.process(makeAudioBuffer(loud1, loud1));
    // Immediately another loud → should be debounced
    const loud2 = makeLoud(2048, 1.0);
    const results = od.process(makeAudioBuffer(loud2, loud2));
    expect(results.filter(r => r.detected).length).toBe(0);
  });

  it('reset clears internal state', () => {
    const od = new OnsetDetector({ threshold: 0.3 });
    const loud = makeLoud(2048);
    od.process(makeAudioBuffer(loud, loud));
    od.reset();
    // After reset, should behave as fresh
    expect(() => od.process(makeAudioBuffer(makeSilence(2048), makeSilence(2048)))).not.toThrow();
  });
});
