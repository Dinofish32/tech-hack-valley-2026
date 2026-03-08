import React, { useEffect, useState } from 'react';
import { usePipelineStore } from '../store/usePipelineStore';

export default function Settings() {
  const { config, setConfig } = usePipelineStore();
  const [devices, setDevices]         = useState([]);
  const [serialPorts, setSerialPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [status, setStatus]           = useState('');
  const [connected, setConnected]     = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.audio.listDevices().then(setDevices).catch(() => {});
    refreshSerialPorts();
    window.electronAPI.transport.onStatus((s) => setConnected(s.connected));
  }, []);

  const refreshSerialPorts = async () => {
    if (!window.electronAPI?.serial) return;
    setLoadingPorts(true);
    const ports = await window.electronAPI.serial.listPorts().catch(() => []);
    setSerialPorts(ports);
    if (ports.length > 0) setSelectedPort((p) => p || ports[0].path);
    setLoadingPorts(false);
  };

  const connect = async () => {
    if (!window.electronAPI || !selectedPort) return;
    setStatus('Connecting...');
    const result = await window.electronAPI.transport.connect({ host: selectedPort });
    setStatus(result.ok ? '' : `Error: ${result.error}`);
  };

  const disconnect = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.transport.disconnect();
    setStatus('');
  };

  return (
    <div className="p-6 max-w-xl flex flex-col gap-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Headband connection */}
      <Section title="Headband">
        <div className="text-xs text-text-muted bg-muted/50 rounded-lg px-3 py-2 mb-3 leading-relaxed">
          Plug in the ESP-NOW dongle, then select its COM port and connect.
        </div>
        <div className="flex gap-2 mb-3">
          <select
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={connected}
            className="bg-muted border border-white/10 rounded px-3 py-2 text-sm text-text flex-1 outline-none focus:border-accent disabled:opacity-50"
          >
            {serialPorts.length === 0
              ? <option value="">— No ports found —</option>
              : serialPorts.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path}{p.manufacturer ? ` — ${p.manufacturer}` : ''}
                  </option>
                ))
            }
          </select>
          <button
            onClick={refreshSerialPorts}
            disabled={loadingPorts || connected}
            className="bg-muted text-text-muted px-3 py-2 rounded text-sm hover:bg-muted/70 disabled:opacity-40"
          >
            {loadingPorts ? '...' : 'Refresh'}
          </button>
        </div>
        <div className="flex gap-2">
          {!connected ? (
            <button
              onClick={connect}
              disabled={!selectedPort}
              className="bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-500 disabled:opacity-40 flex-1"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="bg-danger/20 text-danger px-4 py-2 rounded text-sm hover:bg-danger/30 flex-1"
            >
              Disconnect
            </button>
          )}
        </div>
        {status && (
          <div className="text-xs mt-2 text-danger">{status}</div>
        )}
      </Section>

      {/* Audio device */}
      <Section title="Audio Device">
        <select
          className="bg-muted border border-white/10 rounded px-3 py-2 text-sm text-text outline-none focus:border-accent w-full"
          value={config.deviceIndex ?? ''}
          onChange={(e) => setConfig({ deviceIndex: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Default loopback device</option>
          {devices.map((d) => (
            <option key={d.index} value={d.index}>{d.name}</option>
          ))}
        </select>
      </Section>

      {/* Pipeline mode */}
      <Section title="Pipeline Mode">
        <div className="flex gap-3">
          {[
            { label: 'Full (ONNX)', value: true },
            { label: 'Lightweight (NMF)', value: false },
          ].map(({ label, value }) => (
            <button key={label}
              onClick={() => setConfig({ useOnnxSeparator: value })}
              className={`px-4 py-2 rounded text-sm ${config.useOnnxSeparator === value ? 'bg-accent text-white' : 'bg-muted text-text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Buffer size */}
      <Section title="Buffer Size">
        <div className="flex gap-3">
          {[256, 512, 1024].map((size) => (
            <button key={size}
              onClick={() => setConfig({ bufferSize: size })}
              className={`px-4 py-2 rounded text-sm ${config.bufferSize === size ? 'bg-accent text-white' : 'bg-muted text-text-muted'}`}>
              {size}
            </button>
          ))}
        </div>
      </Section>

      {/* Sensitivity */}
      <Section title={`Global Sensitivity (${config.onsetThreshold?.toFixed(2) ?? '0.30'})`}>
        <input type="range" min={0.05} max={1} step={0.01}
          value={config.onsetThreshold ?? 0.3}
          onChange={(e) => setConfig({ onsetThreshold: Number(e.target.value) })}
          className="w-full accent-accent" />
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-surface border border-muted rounded-xl p-4">
      <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
