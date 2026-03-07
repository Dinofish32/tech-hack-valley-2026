import React from 'react';

const CATEGORY_ICONS = {
  GUNSHOT:   '💥',
  FOOTSTEP:  '👣',
  EXPLOSION: '💣',
  ABILITY:   '✨',
  RELOAD:    '🔄',
  ALERT:     '⚠️',
  UNKNOWN:   '?',
};

const DIR_ARROWS = {
  N: '↑', NE: '↗', E: '→', SE: '↘',
  S: '↓', SW: '↙', W: '←', NW: '↖',
};

const PRIORITY_COLORS = {
  1: 'bg-danger/20 text-danger',
  2: 'bg-warning/20 text-warning',
  3: 'bg-accent/20 text-accent',
  4: 'bg-muted text-text-muted',
};

export default function EventCard({ event }) {
  if (!event) return null;
  const { category, direction, confidence, priority, transmitted, latencyMs, timestamp } = event;
  const time = new Date(timestamp).toLocaleTimeString();

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 text-sm">
      <span className="text-base w-5">{CATEGORY_ICONS[category] || '?'}</span>
      <span className="font-medium w-20 text-text">{category}</span>
      <span className="text-lg w-6 text-center">{DIR_ARROWS[direction] || direction}</span>
      <span className="text-text-muted w-12 text-right">{(confidence * 100).toFixed(0)}%</span>
      <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[priority] || PRIORITY_COLORS[4]}`}>P{priority}</span>
      <span className={`text-xs w-4 ${transmitted ? 'text-success' : 'text-danger'}`}>{transmitted ? '✓' : '✗'}</span>
      <span className="text-text-muted text-xs w-14 text-right">{latencyMs != null ? `${latencyMs.toFixed(1)}ms` : ''}</span>
      <span className="text-text-muted text-xs ml-auto">{time}</span>
    </div>
  );
}
