import React from 'react';
import { usePipelineStore } from '../store/usePipelineStore';

export default function LatencyMeter() {
  const metrics = usePipelineStore((s) => s.metrics);
  const avg = metrics?.avgLatencyMs ?? 0;
  const p95 = metrics?.p95LatencyMs ?? 0;

  const color = p95 > 50 ? 'text-danger' : p95 > 35 ? 'text-warning' : 'text-success';

  return (
    <div className="bg-muted rounded-lg px-4 py-3 flex flex-col gap-1">
      <div className="text-xs text-text-muted font-semibold uppercase tracking-wider">Pipeline Latency</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>
        {avg.toFixed(1)}<span className="text-sm ml-1">ms avg</span>
      </div>
      <div className={`text-sm font-mono ${color}`}>
        p95: {p95.toFixed(1)}ms
        {p95 > 50 && <span className="ml-2 text-xs text-danger"> HIGH — consider Lightweight mode</span>}
      </div>
    </div>
  );
}
