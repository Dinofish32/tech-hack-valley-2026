import React, { useEffect, useRef, useState } from 'react';
import { useDeviceStore } from '../store/useDeviceStore';

const CATEGORY_COLORS = {
  GUNSHOT:  '#EF4444',
  FOOTSTEP: '#F59E0B',
};

const FADE_MS = 300;

export default function HeadbandVisualizer() {
  const recentCommands = useDeviceStore((s) => s.recentCommands);
  const [motorState, setMotorState] = useState({ N: 0, E: 0, S: 0, W: 0 });
  const [motorColor, setMotorColor] = useState({ N: '#64748B', E: '#64748B', S: '#64748B', W: '#64748B' });
  const fadeTimers = useRef({});

  useEffect(() => {
    if (!recentCommands.length) return;
    const latest = recentCommands[0];
    if (!latest) return;

    const color = CATEGORY_COLORS[latest.waveform] || CATEGORY_COLORS.FOOTSTEP;
    const { N, E, S, W } = latest.motors;

    setMotorState({ N, E, S, W });
    setMotorColor({ N: color, E: color, S: color, W: color });

    // Clear existing timers
    Object.values(fadeTimers.current).forEach(clearTimeout);

    // Fade out after FADE_MS
    fadeTimers.current.fade = setTimeout(() => {
      setMotorState({ N: 0, E: 0, S: 0, W: 0 });
    }, FADE_MS);
  }, [recentCommands]);

  const motorQuadrant = (dir, label, colorKey) => {
    const intensity = motorState[dir] / 255;
    const color = motorColor[colorKey];
    return (
      <div
        key={dir}
        className="flex items-center justify-center rounded-xl transition-all duration-150"
        style={{
          backgroundColor: intensity > 0.05 ? `${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')}` : '#1E2A45',
          boxShadow: intensity > 0.1 ? `0 0 ${intensity * 30}px ${color}88` : 'none',
          minWidth: 80,
          minHeight: 80,
        }}
      >
        <span className="text-xs font-bold text-white/70">{label}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div>{motorQuadrant('N', 'N', 'N')}</div>
      <div className="flex gap-2">
        {motorQuadrant('W', 'W', 'W')}
        <div className="w-20 h-20 rounded-full bg-muted border-2 border-accent/30 flex items-center justify-center">
          <span className="text-xs text-text-muted font-bold">PULS8</span>
        </div>
        {motorQuadrant('E', 'E', 'E')}
      </div>
      <div>{motorQuadrant('S', 'S', 'S')}</div>
    </div>
  );
}
