import React, { useState, useEffect } from 'react';

export default function Overlay() {
  const [level, setLevel] = useState(0);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.pipeline.onLevel((l) => setLevel(l));
    api.game.onDetected(() => setDetected(true));
  }, []);

  const active = level > 0.001;
  // Log scale: maps 0.001–0.15 RMS to 0–100% display (game audio range)
  const scaled = active ? Math.min(1, Math.log10(1 + level * 100) / Math.log10(16)) : 0;
  const displayPct = (scaled * 100).toFixed(0);
  const r = Math.round((1 - scaled) * 60);
  const g = Math.round(120 + scaled * 135);

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16,
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(10,15,30,0.85)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '6px 12px',
      color: 'white', fontSize: 11, fontFamily: 'monospace',
      userSelect: 'none', backdropFilter: 'blur(4px)',
    }}>
      {/* Bar meter */}
      <div style={{ width: 60, height: 8, background: '#1E2A45', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${scaled * 100}%`, height: '100%',
          background: `rgb(${r},${g},80)`,
          boxShadow: scaled > 0.3 ? `0 0 6px rgba(80,255,80,0.6)` : 'none',
          transition: 'width 0.06s, background-color 0.06s',
        }} />
      </div>
      <span style={{ color: '#6B7280' }}>VAL</span>
      <span style={{ color: active ? '#86EFAC' : '#4B5563', minWidth: 28, textAlign: 'right' }}>
        {active ? displayPct : '--'}%
      </span>
    </div>
  );
}
