import { create } from 'zustand';

export const usePipelineStore = create((set) => ({
  running: false,
  metrics: {
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    eventsPerSec: 0,
    suppressedPerSec: 0,
    onsetRate: 0,
  },
  config: {
    sampleRate: 48000,
    bufferSize: 512,
    useOnnxSeparator: false,
    hfThreshold: 0.65,
    confidenceThreshold: 0.4,
    enabledCategories: ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'ABILITY', 'RELOAD', 'ALERT', 'UNKNOWN'],
  },
  detectedGame: null,

  audioLevel: 0,

  setRunning: (running) => set({ running }),
  setMetrics: (metrics) => set({ metrics }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setConfig: (config) => set((s) => ({ config: { ...s.config, ...config } })),
  setDetectedGame: (game) => set({ detectedGame: game }),
}));
