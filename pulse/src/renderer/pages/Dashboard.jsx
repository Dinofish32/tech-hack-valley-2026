import React, { useEffect, useState } from 'react';
import HeadbandVisualizer from '../components/HeadbandVisualizer';
import LatencyMeter from '../components/LatencyMeter';
import ConnectionBadge from '../components/ConnectionBadge';
import EventCard from '../components/EventCard';
import { usePipelineStore } from '../store/usePipelineStore';
import { useDeviceStore } from '../store/useDeviceStore';
import { useEventLogStore } from '../store/useEventLogStore';
import { useProfileStore } from '../store/useProfileStore';

const DIRECTION_DEGREES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const CATEGORIES = ['GUNSHOT', 'FOOTSTEP'];
const WAVEFORM_DURATION = { GUNSHOT: 30, FOOTSTEP: 60, EXPLOSION: 400, ABILITY: 120, RELOAD: 160, ALERT: 200 };

function simulateMotors(direction, category) {
  const deg = DIRECTION_DEGREES[direction] ?? 0;
  const rad = (deg * Math.PI) / 180;
  const N = Math.round(Math.max(0, Math.cos(rad)) * 255);
  const E = Math.round(Math.max(0, Math.cos(rad - Math.PI / 2)) * 255);
  const S = Math.round(Math.max(0, Math.cos(rad - Math.PI)) * 255);
  const W = Math.round(Math.max(0, Math.cos(rad - (3 * Math.PI) / 2)) * 255);
  return { motors: { N, E, S, W }, waveform: category, durationMs: WAVEFORM_DURATION[category] ?? 200, timestamp: Date.now() };
}

function SimPanel({ addCommand, addEvent }) {
  const [category, setCategory] = useState('GUNSHOT');
  const dirs = ['NW','N','NE','W','','E','SW','S','SE'];

  function fire(dir) {
    const cmd = simulateMotors(dir, category);
    addCommand(cmd);
    addEvent({ id: Date.now().toString(), category, direction: dir, confidence: 1, priority: 1, transmitted: false, latencyMs: 0, timestamp: Date.now() });
  }

  return (
    <div className="bg-surface rounded-xl p-4">
      <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">Simulation</div>
      <div className="flex gap-3 items-start">
        <div>
          <div className="text-xs text-text-muted mb-1">Category</div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-muted text-text text-xs rounded-lg px-2 py-1 border border-white/10"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">Direction — click to fire</div>
          <div className="grid grid-cols-3 gap-1" style={{ width: 120 }}>
            {dirs.map((d, i) =>
              d ? (
                <button
                  key={d}
                  onClick={() => fire(d)}
                  className="bg-muted hover:bg-accent/40 text-text text-xs font-bold rounded py-2 transition-colors"
                >
                  {d}
                </button>
              ) : (
                <div key={i} className="w-full h-full rounded bg-background/30 flex items-center justify-center">
                  <span className="text-[8px] text-text-muted">●</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { running, setRunning, metrics, detectedGame, config, audioLevel } = usePipelineStore();
  const [movingOverlays, setMovingOverlays] = useState(false);
  const transport = useDeviceStore((s) => s.transport);
  const addCommand = useDeviceStore((s) => s.addCommand);
  const events = useEventLogStore((s) => s.events);
  const addEvent = useEventLogStore((s) => s.addEvent);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const profiles = useProfileStore((s) => s.profiles);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  async function toggleOverlayMove() {
    if (!window.electronAPI?.overlay) return;
    if (movingOverlays) {
      await window.electronAPI.overlay.stopMove();
      setMovingOverlays(false);
    } else {
      await window.electronAPI.overlay.startMove();
      setMovingOverlays(true);
    }
  }

  async function togglePipeline() {
    if (!window.electronAPI) return;
    if (running) {
      await window.electronAPI.pipeline.stop();
      setRunning(false);
    } else {
      const result = await window.electronAPI.pipeline.start(config);
      if (result.ok) setRunning(true);
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-5">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">Dashboard</h1>
        <div className="flex items-center gap-4">
          {detectedGame && (
            <div className="text-xs bg-accent/20 text-accent px-3 py-1 rounded-full">
              {detectedGame.processName}
              {activeProfile && ` — ${activeProfile.name}`}
            </div>
          )}
          <button
            onClick={toggleOverlayMove}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              movingOverlays
                ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                : 'bg-white/5 text-text-muted hover:bg-white/10'
            }`}
          >
            {movingOverlays ? 'Lock Overlays' : 'Move Overlays'}
          </button>
          <button
            onClick={togglePipeline}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
              running
                ? 'bg-danger/20 text-danger hover:bg-danger/30'
                : 'bg-accent text-white hover:bg-accent/80'
            }`}
          >
            {running ? 'Stop Pipeline' : 'Start Pipeline'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-5 flex-1 min-h-0" style={{ minHeight: 300 }}>
        {/* Left: Visualizer */}
        <div className="flex flex-col items-center gap-4 bg-surface rounded-xl p-5 min-w-[260px]">
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Headband</div>
          <HeadbandVisualizer />
          <div className="text-xs text-text-muted mt-auto">
            {running ? (
              <span className="text-success">● Live</span>
            ) : (
              <span className="text-text-muted">● Idle</span>
            )}
          </div>
        </div>

        {/* Center: Metrics + Connection */}
        <div className="flex flex-col gap-4 flex-1">
          <ConnectionBadge transport={transport} large />
          <LatencyMeter />
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Events/s', value: metrics?.eventsPerSec?.toFixed(1) ?? '0' },
              { label: 'Suppressed/s', value: metrics?.suppressedPerSec?.toFixed(1) ?? '0' },
              { label: 'Onset Rate', value: metrics?.onsetRate?.toFixed(1) ?? '0' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted rounded-lg px-3 py-3 text-center">
                <div className="text-text-muted text-xs mb-1">{label}</div>
                <div className="text-xl font-mono font-bold text-text">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simulation panel */}
      <SimPanel addCommand={addCommand} addEvent={addEvent} />

      {/* Live event ticker */}
      <div className="bg-surface rounded-xl p-4 flex flex-col flex-shrink-0" style={{ height: 220 }}>
        <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3 flex-shrink-0">Recent Events</div>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {events.slice(0, 5).map((e, i) => (
            <EventCard key={e.id || i} event={e} />
          ))}
          {events.length === 0 && (
            <div className="text-text-muted text-xs text-center py-4">No events yet. Start the pipeline.</div>
          )}
        </div>
      </div>
    </div>
  );
}