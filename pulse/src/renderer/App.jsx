import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Profiles from './pages/Profiles';
import Calibration from './pages/Calibration';
import EventLog from './pages/EventLog';
import Settings from './pages/Settings';
import PatternEditor from './pages/PatternEditor';
import Overlay from './pages/Overlay';
import MotorOverlay from './pages/MotorOverlay';
import { usePipelineStore } from './store/usePipelineStore';
import { useDeviceStore } from './store/useDeviceStore';
import { useEventLogStore } from './store/useEventLogStore';

export default function App() {
  const setMetrics = usePipelineStore((s) => s.setMetrics);
  const setAudioLevel = usePipelineStore((s) => s.setAudioLevel);
  const addEvent = useEventLogStore((s) => s.addEvent);
  const addCommand = useDeviceStore((s) => s.addCommand);
  const setTransportStatus = useDeviceStore((s) => s.setTransportStatus);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.pipeline.onMetrics((m) => setMetrics(m));
    api.pipeline.onLevel((l) => setAudioLevel(l));
    api.pipeline.onEvent((e) => addEvent(e));
    api.pipeline.onCommand((cmd) => addCommand(cmd));
    api.transport.onStatus((s) => setTransportStatus(s));

    return () => {
      ['pipeline:metrics', 'pipeline:event', 'pipeline:command', 'transport:status'].forEach(
        (ch) => api.pipeline.removeAllListeners?.(ch)
      );
    };
  }, []);

  // Overlay window loads this same bundle with #/overlay hash
  if (window.location.hash === '#/overlay') return <Overlay />;
  if (window.location.hash === '#/motor-overlay') return <MotorOverlay />;

  return (
    <HashRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-text">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/calibration" element={<Calibration />} />
            <Route path="/eventlog" element={<EventLog />} />
            <Route path="/patterns" element={<PatternEditor />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
