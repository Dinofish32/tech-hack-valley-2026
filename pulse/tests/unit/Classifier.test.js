const Classifier = require('../../src/main/pipeline/Classifier');
const { EventCategory } = require('../../src/shared/constants');

function makeSTFTResult() {
  return {
    melL: new Float32Array(128).fill(0.1),
    melR: new Float32Array(128).fill(0.1),
    powerL: [],
    powerR: [],
    hopCount: 4,
  };
}

describe('Classifier', () => {
  it('init without model file does not throw', async () => {
    const c = new Classifier({ modelPath: '/nonexistent/model.onnx' });
    await expect(c.init()).resolves.not.toThrow();
  });

  it('classify returns correct shape (stubbed UNKNOWN)', async () => {
    const c = new Classifier({ modelPath: null });
    await c.init();
    const result = c.classify(makeSTFTResult());
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.category).toBe('string');
    expect(typeof result.confidence).toBe('number');
  });

  it('classify returns UNKNOWN when no model', async () => {
    const c = new Classifier({ modelPath: null });
    await c.init();
    const result = c.classify(makeSTFTResult());
    expect(result.category).toBe(EventCategory.UNKNOWN);
    expect(result.confidence).toBe(0);
  });

  it('classifyAsync returns correct shape', async () => {
    const c = new Classifier({ modelPath: null });
    await c.init();
    const result = await c.classifyAsync(makeSTFTResult());
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('confidence');
  });

  it('category is one of the known EventCategory values', async () => {
    const c = new Classifier({ modelPath: null });
    await c.init();
    const result = c.classify(makeSTFTResult());
    expect(Object.values(EventCategory)).toContain(result.category);
  });
});
