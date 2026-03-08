import React from 'react';

export default function ConnectionBadge({ transport, large = false }) {
  const { connected, address } = transport || {};

  if (large) {
    return (
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
        connected
          ? 'bg-emerald-950/40 border border-emerald-500/20'
          : 'bg-muted border border-transparent'
      }`}>
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-danger'}`} />
        <div>
          <div className={`text-sm font-semibold ${connected ? 'text-emerald-400' : 'text-text-muted'}`}>
            {connected ? 'Headband connected' : 'No headband'}
          </div>
          <div className="text-xs text-text-muted">
            {connected ? address || 'ESP-NOW' : 'Connect in Settings'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-danger'}`} />
      <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-text-muted'}`}>
        {connected ? 'Headband connected' : 'No headband'}
      </span>
    </div>
  );
}
