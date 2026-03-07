import React, { useState, useEffect, useRef } from 'react';

const CATEGORY_COLORS = {
  GUNSHOT:   '#EF4444',
  FOOTSTEP:  '#F59E0B',
  EXPLOSION: '#F97316',
  ABILITY:   '#A855F7',
  RELOAD:    '#3B82F6',
  ALERT:     '#EC4899',
  UNKNOWN:   '#6366F1',
};

const FADE_MS = 400;
const CELL = 44;
const GAP  = 4;

export default function MotorOverlay() {
  const [motors, setMotors] = useState({ N: 0, E: 0, S: 0, W: 0 });
  const [color, setColor]   = useState('#6366F1');
  const [dragMode, setDragMode] = useState(false);
  const fadeTimer = useRef(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.overlay?.onDragMode((mode) => setDragMode(mode));
    api.pipeline.onCommand((cmd) => {
      // Only show motors >= 50% of the peak value — suppresses artifact spikes
      // in the opposite direction while preserving true diagonals (NE, NW, etc.)
      const raw = cmd.motors;
      const peak = Math.max(raw.N, raw.E, raw.S, raw.W);
      const cutoff = peak * 0.5;
      setMotors({
        N: raw.N >= cutoff ? raw.N : 0,
        E: raw.E >= cutoff ? raw.E : 0,
        S: raw.S >= cutoff ? raw.S : 0,
        W: raw.W >= cutoff ? raw.W : 0,
      });
      setColor(CATEGORY_COLORS[cmd.waveform] || '#6366F1');
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setMotors({ N: 0, E: 0, S: 0, W: 0 }), FADE_MS);
    });
  }, []);

  const cell = (dir) => {
    const v   = (motors[dir] || 0) / 255;
    const pct = Math.round(v * 100);
    const hexA = Math.round(v * 210).toString(16).padStart(2, '0');
    const active = v > 0.02;

    return (
      <div style={{
        width: CELL, height: CELL,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 7,
        background: active ? `${color}${hexA}` : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? color + '88' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: v > 0.25 ? `0 0 10px ${color}55` : 'none',
        transition: 'background 0.08s, box-shadow 0.08s',
      }}>
        <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: active ? '#ffffffaa' : '#ffffff18', letterSpacing: 1 }}>{dir}</span>
        <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 800, lineHeight: 1,
          color: active ? '#fff' : '#ffffff15' }}>{pct}</span>
      </div>
    );
  };

  return (
    <>
      <style>{`html,body{background:transparent!important;margin:0;padding:0;overflow:hidden}`}</style>
      <div style={{
        display: 'grid', gridTemplateColumns: `${CELL}px ${CELL}px ${CELL}px`, gap: GAP,
        position: 'fixed', top: 0, left: 0, userSelect: 'none',
        WebkitAppRegion: dragMode ? 'drag' : 'no-drag',
        outline: dragMode ? '2px dashed rgba(99,102,241,0.8)' : 'none',
      }}>
        <div />{cell('N')}<div />
        {cell('W')}
        <div style={{ width: CELL, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
        </div>
        {cell('E')}
        <div />{cell('S')}<div />
      </div>
    </>
  );
}
