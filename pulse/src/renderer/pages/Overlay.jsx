import React, { useState, useEffect, useRef } from 'react';

const COLORS = {
  GUNSHOT:   '#EF4444',
  FOOTSTEP:  '#F59E0B',
  EXPLOSION: '#F97316',
  ABILITY:   '#A855F7',
  RELOAD:    '#3B82F6',
  ALERT:     '#EC4899',
  UNKNOWN:   '#6366F1',
};

// How long the overlay stays lit per category — scaled up from haptic durationMs
// to give the user enough time to register the visual feedback
const DISPLAY_MS = {
  GUNSHOT:   2000,
  EXPLOSION: 2500,
  FOOTSTEP:  1500,
  ABILITY:   1500,
  ALERT:     1200,
  RELOAD:    1000,
  UNKNOWN:    800,
};

const DIAGONALS = new Set(['NE', 'NW', 'SE', 'SW']);

/** Derive compass direction from motor values (same logic as direction decoder) */
function peakDirection(motors) {
  if (!motors) return null;
  const entries = Object.entries(motors)
    .map(([d, v]) => [d, v || 0])
    .sort((a, b) => b[1] - a[1]);
  if (!entries[0][1]) return null;
  const [d1, v1] = entries[0];
  const [d2, v2] = entries[1];
  // Combine into diagonal if second motor is >= 40% of peak
  if (v2 > v1 * 0.4) {
    const c1 = d1 + d2;
    const c2 = d2 + d1;
    if (DIAGONALS.has(c1)) return c1;
    if (DIAGONALS.has(c2)) return c2;
  }
  return d1;
}

export default function Overlay() {
  const [level, setLevel]       = useState(0);
  const [evt, setEvt]           = useState(null);    // { category, direction, color }
  const [visible, setVisible]   = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const hideTimer               = useRef(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.pipeline.onLevel((l) => setLevel(l));
    api.overlay?.onDragMode((mode) => setDragMode(mode));

    // Only light up when a command is actually dispatched to the MCU
    api.pipeline.onCommand((cmd) => {
      const cat   = cmd.waveform || 'UNKNOWN';
      const color = COLORS[cat] || COLORS.UNKNOWN;
      const dir   = peakDirection(cmd.motors);
      setEvt({ category: cat, direction: dir, color });
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), DISPLAY_MS[cat] || 1000);
    });
  }, []);

  const active  = level > 0.001;
  const scaled  = active
    ? Math.min(1, Math.log10(1 + level * 100) / Math.log10(16))
    : 0;
  // Level bar takes category color while active, otherwise green gradient
  const barColor = evt && visible
    ? evt.color
    : `rgb(${Math.round((1 - scaled) * 60)},${Math.round(120 + scaled * 135)},80)`;

  return (
    <>
      <style>{`html,body{background:transparent!important;margin:0;padding:0;overflow:hidden}`}</style>
      <div style={{
        position: 'fixed', top: 0, right: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(8,12,24,0.90)',
        border: dragMode
          ? '2px dashed rgba(99,102,241,0.8)'
          : `1px solid ${visible && evt ? evt.color + '50' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '0 0 0 10px',
        padding: '6px 10px',
        fontFamily: 'monospace', color: 'white', fontSize: 11,
        userSelect: 'none',
        WebkitAppRegion: dragMode ? 'drag' : 'no-drag',
        boxShadow: visible && evt ? `0 0 16px ${evt.color}28` : 'none',
        transition: 'border-color 0.25s, box-shadow 0.25s',
        minWidth: 180,
      }}>

        {/* Category dot + name + direction — fades in fast, fades out slow */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flex: 1,
          opacity: visible && evt ? 1 : 0,
          transform: visible && evt ? 'translateX(0)' : 'translateX(3px)',
          transition: visible
            ? 'opacity 0.08s ease-out, transform 0.08s ease-out'
            : 'opacity 0.45s ease-in,  transform 0.45s ease-in',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: evt?.color || 'transparent',
            boxShadow: evt ? `0 0 7px ${evt.color}` : 'none',
          }} />
          <span style={{
            color: evt?.color || '#fff',
            fontWeight: 700, letterSpacing: 0.8, flex: 1,
          }}>
            {evt?.category ?? ''}
          </span>
          {evt?.direction && (
            <span style={{ color: 'rgba(255,255,255,0.40)', fontSize: 10, fontWeight: 600 }}>
              {evt.direction}
            </span>
          )}
        </div>

        {/* Audio level bar — always visible, subtle */}
        <div style={{
          width: 38, height: 5,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 3, overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{
            width: `${scaled * 100}%`, height: '100%',
            background: barColor,
            transition: 'width 0.06s, background-color 0.35s',
          }} />
        </div>

      </div>
    </>
  );
}
