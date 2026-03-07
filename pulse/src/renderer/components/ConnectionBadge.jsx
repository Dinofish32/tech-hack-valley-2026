import React from 'react';

const TYPE_LABELS = { WEBSOCKET: 'WebSocket', BLE: 'BLE', NONE: 'Disconnected' };

export default function ConnectionBadge({ transport, large = false }) {
  const { connected, type, latencyMs, address } = transport || {};

  const dot = connected ? 'bg-success' : 'bg-danger';
  const label = TYPE_LABELS[type] || 'Disconnected';

  if (large) {
    return (
      <div className="flex items-center gap-3 bg-muted rounded-lg px-4 py-3">
        <span className={`w-3 h-3 rounded-full ${dot} animate-pulse`} />
        <div>
          <div className="text-sm font-semibold text-text">{label}</div>
          {address && <div className="text-xs text-text-muted">{address}</div>}
          {connected && latencyMs != null && (
            <div className="text-xs text-text-muted">{latencyMs}ms ping</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
