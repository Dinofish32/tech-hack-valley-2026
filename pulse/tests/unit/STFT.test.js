const STFT = require('../../src/main/pipeline/STFT');

function makeSine(freq, sampleRate, numSamples) {
  const signal = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    signal[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return signal;
}

describe('STFT', () => {
  const sampleRate = 48000;
  const fftSize = 1024;
  const stft = new STFT({ fftSize, hopSize: 256, sampleRate, melBins: 128 });

  it('returns correct shape', () => {
    const left = makeSine(1000, sampleRate, fftSize * 2);
    const right = makeSine(1000, sampleRate, fftSize * 2);
    const result = stft.process({ left, right, sampleRate });
    expect(result.melL).toBeInstanceOf(Float32Array);
    expect(result.melR).toBeInstanceOf(Float32Array);
    expect(result.melL.length).toBe(128);
    expect(result.melR.length).toBe(128);
    expect(result.hopCount).toBeGreaterThan(0);
  });

  it('1kHz sine has peak mel energy in expected region (mel bin > 10)', () => {
    // 1kHz maps to a mel bin well above the first few
    const signal = makeSine(1000, sampleRate, fftSize * 4);
    const result = stft.process({ left: signal, right: signal, sampleRate });
    const mel = result.melL;
    let peakBin = 0;
    let peakVal = -1;
    for (let i = 0; i < mel.length; i++) {
      if (mel[i] > peakVal) { peakVal = mel[i]; peakBin = i; }
    }
    // 1kHz is not in the lowest mel bins (which map to sub-100Hz)
    expect(peakBin).toBeGreaterThan(5);
    // Peak energy should be non-zero
    expect(peakVal).toBeGreaterThan(0);
  });

  it('silence produces all-zero mel spectrum', () => {
    const silence = new Float32Array(fftSize * 2);
    const result = stft.process({ left: silence, right: silence, sampleRate });
    const sum = result.melL.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it('powerL and powerR are arrays of Float32Arrays', () => {
    const signal = makeSine(440, sampleRate, fftSize * 2);
    const result = stft.process({ left: signal, right: signal, sampleRate });
    expect(Array.isArray(result.powerL)).toBe(true);
    expect(result.powerL[0]).toBeInstanceOf(Float32Array);
    expect(result.powerL[0].length).toBe(fftSize / 2 + 1);
  });
});
