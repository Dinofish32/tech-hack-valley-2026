import React, { useRef, useEffect, useCallback } from 'react';

export default function WaveformCanvas({ segments, onSegmentsChange, width = 600, height = 120 }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !segments) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0D1117';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1E2A45';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    if (!segments.length) return;

    const totalDuration = segments.reduce((s, seg) => s + seg.durationMs, 0) || 1;
    let x = 0;

    segments.forEach((seg, idx) => {
      const segWidth = (seg.durationMs / totalDuration) * width;
      const segHeight = (seg.intensity / 100) * (height - 10);
      const y = height - segHeight;

      ctx.fillStyle = idx % 2 === 0 ? '#2563EB66' : '#3B82F666';
      ctx.fillRect(x, y, segWidth, segHeight);

      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, segWidth, segHeight);

      // Label
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '10px system-ui';
      ctx.fillText(`${seg.durationMs}ms`, x + 4, y + 14);
      ctx.fillText(`${seg.intensity}%`, x + 4, height - 4);

      x += segWidth;
    });
  }, [segments, width, height]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-muted cursor-crosshair"
    />
  );
}
