import React from 'react';

const PRIORITY_LABELS = { 1: 'P1 Critical', 2: 'P2 High', 3: 'P3 Medium', 4: 'P4 Low' };

export default function PrioritySlider({ category, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text w-24">{category}</span>
      <input
        type="range"
        min={1}
        max={4}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="text-xs text-text-muted w-20">{PRIORITY_LABELS[value]}</span>
    </div>
  );
}
