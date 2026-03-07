import React, { useState } from 'react';
import { useEventLogStore } from '../store/useEventLogStore';
import EventCard from '../components/EventCard';

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const CATEGORIES = ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'ABILITY', 'RELOAD', 'ALERT', 'UNKNOWN'];

export default function EventLog() {
  const { events, paused, filters, setPaused, setFilters, clearEvents, getFilteredEvents } = useEventLogStore();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = getFilteredEvents();
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const exportCSV = () => {
    const rows = [
      'id,timestamp,category,direction,confidence,priority,transmitted,latencyMs',
      ...filtered.map((e) =>
        `${e.id},${e.timestamp},${e.category},${e.direction},${(e.confidence * 100).toFixed(1)},${e.priority},${e.transmitted ? 1 : 0},${e.latencyMs || 0}`
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `puls8-events-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Event Log</h1>
        <div className="flex gap-2">
          <button onClick={() => setPaused(!paused)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${paused ? 'bg-warning/20 text-warning' : 'bg-muted text-text-muted'}`}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={exportCSV} className="px-3 py-1.5 rounded text-xs bg-muted text-text-muted hover:bg-muted/70">Export CSV</button>
          <button onClick={clearEvents} className="px-3 py-1.5 rounded text-xs bg-danger/20 text-danger hover:bg-danger/30">Clear</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select className="bg-muted text-sm text-text rounded px-2 py-1.5 outline-none border border-muted focus:border-accent"
          value={filters.category}
          onChange={(e) => { setFilters({ category: e.target.value }); setPage(0); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="bg-muted text-sm text-text rounded px-2 py-1.5 outline-none border border-muted focus:border-accent"
          value={filters.direction}
          onChange={(e) => { setFilters({ direction: e.target.value }); setPage(0); }}>
          <option value="">All Directions</option>
          {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input type="number" min={0} max={100} value={Math.round((filters.minConfidence || 0) * 100)}
            onChange={(e) => { setFilters({ minConfidence: Number(e.target.value) / 100 }); setPage(0); }}
            className="bg-muted border border-muted rounded px-2 py-1.5 w-16 text-sm text-text outline-none" />
          Min %
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input type="checkbox" checked={!!filters.transmittedOnly}
            onChange={(e) => { setFilters({ transmittedOnly: e.target.checked }); setPage(0); }} />
          Transmitted only
        </label>
      </div>

      {/* Stats */}
      <div className="text-xs text-text-muted">{filtered.length} events{paused ? ' (paused)' : ''}</div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {paged.map((e, i) => <EventCard key={e.id || i} event={e} />)}
        {paged.length === 0 && (
          <div className="text-text-muted text-sm text-center py-10">No events match filters.</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="text-xs text-text-muted disabled:opacity-30 hover:text-text">← Prev</button>
          <span className="text-xs text-text-muted">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}
            className="text-xs text-text-muted disabled:opacity-30 hover:text-text">Next →</button>
        </div>
      )}
    </div>
  );
}
