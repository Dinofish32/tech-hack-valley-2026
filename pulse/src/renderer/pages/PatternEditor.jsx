import React, { useState } from 'react';
import WaveformCanvas from '../components/WaveformCanvas';

const DEFAULT_PATTERNS = {
  GUNSHOT:  [{ durationMs: 30, intensity: 100 }],
  FOOTSTEP: [{ durationMs: 20, intensity: 60 }, { durationMs: 10, intensity: 0 }, { durationMs: 20, intensity: 60 }],
};

const CATEGORIES = Object.keys(DEFAULT_PATTERNS);

export default function PatternEditor() {
  const [selectedCategory, setSelectedCategory] = useState('GUNSHOT');
  const [patterns, setPatterns] = useState({ ...DEFAULT_PATTERNS });

  const segs = patterns[selectedCategory] || [];

  const addSegment = () => {
    setPatterns({
      ...patterns,
      [selectedCategory]: [...segs, { durationMs: 50, intensity: 50 }],
    });
  };

  const deleteSegment = (idx) => {
    setPatterns({
      ...patterns,
      [selectedCategory]: segs.filter((_, i) => i !== idx),
    });
  };

  const updateSegment = (idx, field, value) => {
    const updated = segs.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    setPatterns({ ...patterns, [selectedCategory]: updated });
  };

  const resetToDefault = () => {
    setPatterns({ ...patterns, [selectedCategory]: [...DEFAULT_PATTERNS[selectedCategory]] });
  };

  const preview = async () => {
    if (!window.electronAPI) return;
    const totalMs = segs.reduce((s, seg) => s + seg.durationMs, 0);
    await window.electronAPI.calibration.fire({
      motor: 'N',
      intensity: Math.round((segs[0]?.intensity ?? 80) / 100 * 255),
      waveform: selectedCategory,
    });
  };

  return (
    <div className="p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pattern Editor</h1>
        <div className="flex gap-2">
          <button onClick={preview} className="px-4 py-2 bg-accent text-white rounded text-sm hover:bg-accent/80">Preview on hardware</button>
          <button onClick={resetToDefault} className="px-4 py-2 bg-muted text-text-muted rounded text-sm hover:bg-muted/70">Reset to default</button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${selectedCategory === cat ? 'bg-accent text-white' : 'bg-muted text-text-muted hover:bg-muted/70'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="bg-surface rounded-xl p-4">
        <div className="text-xs text-text-muted mb-3">X = time (ms) | Y = intensity (0–100%)</div>
        <WaveformCanvas segments={segs} width={580} height={130} />
      </div>

      {/* Segment list */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Segments</div>
          <button onClick={addSegment} className="text-xs text-accent hover:underline">+ Add segment</button>
        </div>
        {segs.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-muted rounded-lg px-4 py-3">
            <span className="text-xs text-text-muted w-4">{idx + 1}</span>
            <label className="flex items-center gap-2 text-xs text-text-muted flex-1">
              Duration (ms)
              <input type="number" min={5} max={2000} value={seg.durationMs}
                onChange={(e) => updateSegment(idx, 'durationMs', Number(e.target.value))}
                className="bg-surface border border-muted rounded px-2 py-1 w-20 text-text outline-none" />
            </label>
            <label className="flex items-center gap-2 text-xs text-text-muted flex-1">
              Intensity (%)
              <input type="range" min={0} max={100} value={seg.intensity}
                onChange={(e) => updateSegment(idx, 'intensity', Number(e.target.value))}
                className="flex-1 accent-accent" />
              <span className="w-8 text-right">{seg.intensity}</span>
            </label>
            <button onClick={() => deleteSegment(idx)} className="text-xs text-danger hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
