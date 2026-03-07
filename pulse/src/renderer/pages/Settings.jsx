import React, { useEffect, useState } from 'react';
import { usePipelineStore } from '../store/usePipelineStore';

export default function Settings() {
  const { config, setConfig } = usePipelineStore();
  const [devices, setDevices] = useState([]);
  const [transport, setTransport] = useState({ type: 'WEBSOCKET', host: '', port: 8765 });
  const [bleDevices, setBleDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.audio.listDevices().then(setDevices).catch(() => {});
  }, []);

  const connectTransport = async () => {
    if (!window.electronAPI) return;
    setStatus('Connecting...');
    const result = await window.electronAPI.transport.connect({
      type: transport.type,
      port: transport.port,
      host: transport.host,
    });
    setStatus(result.ok ? 'Connected!' : `Error: ${result.error}`);
  };

  const disconnectTransport = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.transport.disconnect();
    setStatus('Disconnected.');
  };

  const scanBLE = async () => {
    if (!window.electronAPI) return;
    setScanning(true);
    const found = await window.electronAPI.transport.scan();
    setBleDevices(found);
    setScanning(false);
  };

  return (
    <div className="p-6 max-w-xl flex flex-col gap-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Transport */}
      <Section title="Transport">
        <div className="flex gap-3 mb-3">
          {['WEBSOCKET', 'BLE'].map((t) => (
            <button key={t}
              onClick={() => setTransport({ ...transport, type: t })}
              className={`px-4 py-2 rounded text-sm ${transport.type === t ? 'bg-accent text-white' : 'bg-muted text-text-muted'}`}>
              {t === 'WEBSOCKET' ? 'WebSocket' : 'Bluetooth'}
            </button>
          ))}
        </div>

        {transport.type === 'WEBSOCKET' && (
          <div className="flex gap-2">
            <input placeholder="Port" type="number" value={transport.port}
              onChange={(e) => setTransport({ ...transport, port: Number(e.target.value) })}
              className="bg-muted border border-muted rounded px-3 py-2 text-sm text-text w-28 outline-none focus:border-accent" />
            <button onClick={connectTransport} className="bg-accent text-white px-4 py-2 rounded text-sm hover:bg-accent/80">Connect</button>
            <button onClick={disconnectTransport} className="bg-muted text-text-muted px-4 py-2 rounded text-sm hover:bg-muted/70">Disconnect</button>
          </div>
        )}

        {transport.type === 'BLE' && (
          <div>
            <button onClick={scanBLE} disabled={scanning}
              className="bg-accent text-white px-4 py-2 rounded text-sm hover:bg-accent/80 disabled:opacity-50 mb-3">
              {scanning ? 'Scanning...' : 'Scan for devices'}
            </button>
            {bleDevices.map((d) => (
              <div key={d.id} className="flex items-center gap-3 bg-muted rounded px-3 py-2 mb-2">
                <span className="text-sm text-text flex-1">{d.name} ({d.id})</span>
                <span className="text-xs text-text-muted">{d.rssi} dBm</span>
                <button onClick={() => window.electronAPI?.transport.connect({ type: 'BLE', deviceId: d.id })}
                  className="text-xs text-accent hover:underline">Connect</button>
              </div>
            ))}
          </div>
        )}

        {status && <div className="text-xs text-text-muted mt-2">{status}</div>}
      </Section>

      {/* Audio device */}
      <Section title="Audio Device">
        <select className="bg-muted border border-muted rounded px-3 py-2 text-sm text-text outline-none focus:border-accent w-full"
          value={config.deviceIndex ?? ''}
          onChange={(e) => setConfig({ deviceIndex: e.target.value ? Number(e.target.value) : null })}>
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
