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

  const active = level > 0.005;
  const intensity = Math.min(1, level * 15);
  const r = Math.round((1 - intensity) * 80);
  const g = Math.round(80 + intensity * 175);

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
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        backgroundColor: active ? `rgb(${r},${g},80)` : '#1E2A45',
        boxShadow: active ? `0 0 ${intensity * 14}px rgba(80,255,80,0.7)` : 'none',
        transition: 'background-color 0.06s',
      }} />
      <span style={{ color: '#6B7280' }}>VALORANT</span>
      <span style={{ color: active ? '#86EFAC' : '#4B5563', minWidth: 38, textAlign: 'right' }}>
        {active ? (level * 100).toFixed(1) : '---'}%
      </span>
    </div>
  );
}
