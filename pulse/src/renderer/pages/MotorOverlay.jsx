import React, { useState, useEffect, useRef } from 'react';

const CATEGORY_COLORS = {
  GUNSHOT:   '#EF4444',
  FOOTSTEP:  '#F59E0B',
  EXPLOSION: '#F97316',
  ABILITY:   '#A855F7',
  RELOAD:    '#3B82F6',
  ALERT:     '#EC4899',
  UNKNOWN:   '#64748B',
};

const FADE_MS = 400;

export default function MotorOverlay() {
  const [motors, setMotors] = useState({ N: 0, E: 0, S: 0, W: 0 });
  const [color, setColor]   = useState('#64748B');
  const [label, setLabel]   = useState('');
  const fadeTimer = useRef(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.pipeline.onCommand((cmd) => {
      setMotors(cmd.motors);
      setColor(CATEGORY_COLORS[cmd.waveform] || '#64748B');
      setLabel(cmd.waveform || '');
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        setMotors({ N: 0, E: 0, S: 0, W: 0 });
        setLabel('');
      }, FADE_MS);
    });
  }, []);

  const bar = (dir) => {
    const v = (motors[dir] || 0) / 255;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 12, color: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}>{dir}</span>
        <div style={{ width: 70, height: 7, background: '#1E2A45', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${v * 100}%`, height: '100%',
            background: v > 0.05 ? color : '#1E2A45',
            boxShadow: v > 0.1 ? `0 0 6px ${color}88` : 'none',
            transition: 'width 0.05s',
          }} />
        </div>
        <span style={{ width: 24, textAlign: 'right', fontSize: 10, fontFamily: 'monospace',
          color: v > 0.05 ? '#E5E7EB' : '#374151' }}>
          {Math.round(v * 100)}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16,
      background: 'rgba(10,15,30,0.85)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '8px 12px',
      userSelect: 'none', backdropFilter: 'blur(4px)',
      minWidth: 130,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#6B7280', fontFamily: 'monospace' }}>MOTORS</span>
        {label && (
          <span style={{ fontSize: 9, color: color, fontFamily: 'monospace',
            background: `${color}22`, borderRadius: 3, padding: '1px 5px' }}>
            {label}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bar('N')}
        {bar('E')}
        {bar('S')}
        {bar('W')}
      </div>
    </div>
  );
}
