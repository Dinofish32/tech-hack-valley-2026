// import React, { useState } from 'react';

// const MOTORS = ['N', 'E', 'S', 'W'];
// const MOTOR_LABELS = { N: 'North', E: 'East', S: 'South', W: 'West' };

// const WAVEFORMS = ['GUNSHOT', 'FOOTSTEP'];

// export default function Calibration() {
//   const [step, setStep] = useState(1);

//   return (
//     <div className="p-6 max-w-2xl">
//       <h1 className="text-xl font-bold mb-2">Calibration</h1>
//       <p className="text-text-muted text-sm mb-6">3-step wizard to configure your Pulse8 headband.</p>

//       {/* Step indicator */}
//       <div className="flex gap-2 mb-8">
//         {[1, 2, 3].map((s) => (
//           <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-accent' : 'bg-muted'}`} />
//         ))}
//       </div>

//       {step === 1 && <Step1 onNext={() => setStep(2)} />}
//       {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
//       {step === 3 && <Step3 onBack={() => setStep(2)} />}
//     </div>
//   );
// }

// function Step1({ onNext }) {
//   const [intensities, setIntensities] = useState({ N: 200, E: 200, S: 200, W: 200 });
//   const [confirmed, setConfirmed] = useState({});

//   const fire = async (motor) => {
//     if (!window.electronAPI) return;
//     await window.electronAPI.calibration.fire({
//       motor,
//       intensity: intensities[motor],
//       waveform: 'ALERT',
//     });
//   };

//   return (
//     <div>
//       <h2 className="text-lg font-semibold mb-1">Step 1 — Motor Test</h2>
//       <p className="text-text-muted text-sm mb-5">Fire each motor one at a time. Adjust intensity until you can clearly feel it.</p>
//       {MOTORS.map((m) => (
//         <div key={m} className="flex items-center gap-4 mb-4 bg-muted rounded-lg px-4 py-3">
//           <span className="font-bold w-16">{MOTOR_LABELS[m]}</span>
//           <input type="range" min={50} max={255} value={intensities[m]}
//             onChange={(e) => setIntensities({ ...intensities, [m]: Number(e.target.value) })}
//             className="flex-1 accent-accent" />
//           <span className="text-xs text-text-muted w-8">{intensities[m]}</span>
//           <button onClick={() => fire(m)} className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:bg-accent/80">Fire</button>
//           <button
//             onClick={() => setConfirmed({ ...confirmed, [m]: true })}
//             className={`px-3 py-1.5 rounded text-xs ${confirmed[m] ? 'bg-success/20 text-success' : 'bg-muted text-text-muted border border-muted'}`}
//           >{confirmed[m] ? '✓ Felt' : 'I feel it'}</button>
//         </div>
//       ))}
//       <button onClick={onNext}
//         disabled={Object.keys(confirmed).length < 4}
//         className="mt-4 px-5 py-2 bg-accent text-white rounded-lg text-sm disabled:opacity-40 hover:bg-accent/80">
//         Next →
//       </button>
//     </div>
//   );
// }

// function Step2({ onNext, onBack }) {
//   const [responses, setResponses] = useState([]);
//   const [current, setCurrent] = useState(0);
//   const SAMPLES = 5; // simplified: 5 rounds of front/back

//   const respond = (isFront) => {
//     const updated = [...responses, isFront];
//     setResponses(updated);
//     if (updated.length >= SAMPLES) {
//       const frontCount = updated.filter(Boolean).length;
//       const accuracy = Math.round((frontCount / SAMPLES) * 100);
//       alert(`Calibration complete!\nFront accuracy: ${accuracy}%\nHF threshold will be saved.`);
//       onNext();
//     } else {
//       setCurrent(updated.length);
//     }
//   };

//   return (
//     <div>
//       <h2 className="text-lg font-semibold mb-1">Step 2 — Front/Back Threshold</h2>
//       <p className="text-text-muted text-sm mb-5">
//         Listen carefully and indicate if the sound feels like it came from the front or back.
//         ({current + 1} / {SAMPLES})
//       </p>
//       <div className="bg-muted rounded-xl p-8 text-center mb-6">
//         <div className="text-text-muted text-sm mb-4">Playing sample {current + 1}...</div>
//         <div className="text-4xl mb-6">🔊</div>
//         <div className="flex gap-4 justify-center">
//           <button onClick={() => respond(true)} className="px-6 py-3 bg-accent text-white rounded-lg text-sm hover:bg-accent/80">Front</button>
//           <button onClick={() => respond(false)} className="px-6 py-3 bg-muted border border-muted text-text rounded-lg text-sm hover:bg-muted/70">Back</button>
//         </div>
//       </div>
//       <button onClick={onBack} className="text-text-muted text-sm hover:text-text">← Back</button>
//     </div>
//   );
// }

// function Step3({ onBack }) {
//   const [current, setCurrent] = useState(0);

//   return (
//     <div>
//       <h2 className="text-lg font-semibold mb-1">Step 3 — Pattern Training</h2>
//       <p className="text-text-muted text-sm mb-5">
//         Feel each vibration pattern and memorize what it represents. No input needed — just read and feel.
//       </p>
//       <div className="bg-muted rounded-xl p-6 text-center mb-4">
//         <div className="text-2xl font-bold text-accent mb-2">{WAVEFORMS[current]}</div>
//         <div className="text-text-muted text-sm mb-4">Playing waveform pattern...</div>
//         <div className="text-4xl">📳</div>
//       </div>
//       <div className="flex items-center justify-between mt-4">
//         <button onClick={onBack} className="text-text-muted text-sm hover:text-text">← Back</button>
//         <div className="text-xs text-text-muted">{current + 1} / {WAVEFORMS.length}</div>
//         {current < WAVEFORMS.length - 1 ? (
//           <button onClick={() => setCurrent(current + 1)} className="px-5 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/80">Next →</button>
//         ) : (
//           <div className="text-success text-sm font-semibold">✓ Complete!</div>
//         )}
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect } from 'react';
import WaveformCanvas from '../components/WaveformCanvas';

const PATTERNS_KEY    = 'puls8_calibration_patterns';
const STEP_KEY        = 'puls8_calibration_step';
const INTENSITIES_KEY = 'puls8_calibration_intensities';

const MOTORS = ['N', 'E', 'S', 'W'];
const MOTOR_LABELS = { N: 'North (Forehead)', E: 'East (Right Temple)', S: 'South (Back)', W: 'West (Left Temple)' };

const WAVEFORMS = ['GUNSHOT', 'FOOTSTEP'];

const DEFAULT_PATTERNS = {
  GUNSHOT:  [{ durationMs: 30, intensity: 100 }],
  FOOTSTEP: [{ durationMs: 20, intensity: 60 }, { durationMs: 10, intensity: 0 }, { durationMs: 20, intensity: 60 }],
};

const TOTAL_STEPS = 4;

export default function Calibration() {
  const [step, setStep] = useState(() => {
    const saved = parseInt(localStorage.getItem(STEP_KEY), 10);
    return saved >= 1 && saved <= TOTAL_STEPS ? saved : 1;
  });

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-2">Calibration</h1>
      <p className="text-text-muted text-sm mb-6">
        {TOTAL_STEPS}-step setup to configure your Pulse8 headband for spatial haptic feedback.
      </p>

      {/* Step indicator */}
      <div className="flex gap-2 mb-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-accent' : 'bg-muted'}`} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-text-muted mb-8 px-0.5">
        <span>Motor Test</span>
        <span>Front/Back</span>
        <span>Pattern Training</span>
        <span>Pattern Editor</span>
      </div>

      {step === 1 && <Step1 onNext={() => setStep(2)} />}
      {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <Step3 onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <Step4 onBack={() => setStep(3)} />}
    </div>
  );
}

/* ─── Step 1: Motor Test ─────────────────────────────────────────────────── */
function Step1({ onNext }) {
  const [intensities, setIntensities] = useState(() => {
    try {
      const saved = localStorage.getItem(INTENSITIES_KEY);
      return saved ? JSON.parse(saved) : { N: 200, E: 200, S: 200, W: 200 };
    } catch {
      return { N: 200, E: 200, S: 200, W: 200 };
    }
  });
  const [confirmed, setConfirmed] = useState({});

  useEffect(() => {
    localStorage.setItem(INTENSITIES_KEY, JSON.stringify(intensities));
  }, [intensities]);

  const fire = async (motor) => {
    if (!window.electronAPI) return;
    await window.electronAPI.calibration.fire({
      motor,
      intensity: intensities[motor],
      waveform: 'GUNSHOT',
    });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 1 — Motor Test</h2>
      <p className="text-text-muted text-sm mb-5">
        Each motor corresponds to a position on the headband. Fire each one and adjust
        intensity until you can clearly feel the vibration. Confirm all four before continuing.
      </p>
      {MOTORS.map((m) => (
        <div key={m} className="flex items-center gap-4 mb-4 bg-muted rounded-lg px-4 py-3">
          <span className="font-bold w-40 text-sm">{MOTOR_LABELS[m]}</span>
          <input
            type="range" min={50} max={255} value={intensities[m]}
            onChange={(e) => setIntensities({ ...intensities, [m]: Number(e.target.value) })}
            className="flex-1 accent-accent"
          />
          <span className="text-xs text-text-muted w-8">{intensities[m]}</span>
          <button
            onClick={() => fire(m)}
            className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:bg-accent/80"
          >
            Fire
          </button>
          <button
            onClick={() => setConfirmed({ ...confirmed, [m]: true })}
            className={`px-3 py-1.5 rounded text-xs ${confirmed[m] ? 'bg-success/20 text-success' : 'bg-surface text-text-muted border border-white/10'}`}
          >
            {confirmed[m] ? '✓ Felt' : 'I feel it'}
          </button>
        </div>
      ))}
      <button
        onClick={onNext}
        disabled={Object.keys(confirmed).length < 4}
        className="mt-4 px-5 py-2 bg-accent text-white rounded-lg text-sm disabled:opacity-40 hover:bg-accent/80"
      >
        Next →
      </button>
    </div>
  );
}

/* ─── Step 2: Front/Back Threshold ──────────────────────────────────────── */
function Step2({ onNext, onBack }) {
  const [responses, setResponses] = useState([]);
  const [current, setCurrent] = useState(0);
  const SAMPLES = 5;

  const respond = (isFront) => {
    const updated = [...responses, isFront];
    setResponses(updated);
    if (updated.length >= SAMPLES) {
      onNext();
    } else {
      setCurrent(updated.length);
    }
  };

  const progress = Math.round((current / SAMPLES) * 100);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 2 — Front/Back Threshold</h2>
      <p className="text-text-muted text-sm mb-5">
        The headband will fire a vibration on either the front or back motor. Indicate which
        side you felt it on. This helps calibrate directional sensitivity for in-game spatial cues.
        ({current + 1} / {SAMPLES})
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full mb-6">
        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="bg-muted rounded-xl p-8 text-center mb-6">
        <div className="text-text-muted text-sm mb-4">Firing motor now — which side did you feel?</div>
        <div className="text-4xl mb-6">📳</div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => respond(true)}
            className="px-6 py-3 bg-accent text-white rounded-lg text-sm hover:bg-accent/80"
          >
            Front
          </button>
          <button
            onClick={() => respond(false)}
            className="px-6 py-3 bg-surface border border-white/10 text-text rounded-lg text-sm hover:bg-surface/70"
          >
            Back
          </button>
        </div>
      </div>
      <button onClick={onBack} className="text-text-muted text-sm hover:text-text">← Back</button>
    </div>
  );
}

/* ─── Step 3: Pattern Training ───────────────────────────────────────────── */
function Step3({ onNext, onBack }) {
  const [current, setCurrent] = useState(0);
  const [played, setPlayed] = useState({});

  const playPattern = async (waveform) => {
    if (!window.electronAPI) return;
    await window.electronAPI.calibration.fire({
      motor: 'N',
      intensity: 200,
      waveform,
    });
    setPlayed({ ...played, [waveform]: true });
  };

  const DESCRIPTIONS = {
    GUNSHOT:  'A single sharp, short burst — represents a nearby gunshot or weapon fire.',
    FOOTSTEP: 'Two soft double-taps — represents enemy footsteps approaching.',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 3 — Pattern Training</h2>
      <p className="text-text-muted text-sm mb-5">
        Feel each vibration pattern and memorize what it represents in-game. Press "Play" to
        feel the pattern on your headband, then advance when you're ready.
      </p>

      <div className="bg-muted rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-2xl font-bold text-accent">{WAVEFORMS[current]}</div>
          <button
            onClick={() => playPattern(WAVEFORMS[current])}
            className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:bg-accent/80"
          >
            {played[WAVEFORMS[current]] ? '↺ Replay' : '▶ Play'}
          </button>
        </div>
        <p className="text-text-muted text-sm">{DESCRIPTIONS[WAVEFORMS[current]]}</p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button onClick={onBack} className="text-text-muted text-sm hover:text-text">← Back</button>
        <div className="text-xs text-text-muted">{current + 1} / {WAVEFORMS.length}</div>
        {current < WAVEFORMS.length - 1 ? (
          <button
            onClick={() => setCurrent(current + 1)}
            className="px-5 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/80"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={onNext}
            className="px-5 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/80"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Step 4: Pattern Editor (merged from PatternEditor.jsx) ─────────────── */
function Step4({ onBack }) {
  const [selectedCategory, setSelectedCategory] = useState('GUNSHOT');
  const [patterns, setPatterns] = useState(() => {
    try {
      const saved = localStorage.getItem(PATTERNS_KEY);
      return saved ? { ...DEFAULT_PATTERNS, ...JSON.parse(saved) } : { ...DEFAULT_PATTERNS };
    } catch {
      return { ...DEFAULT_PATTERNS };
    }
  });

  useEffect(() => {
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns));
  }, [patterns]);

  const segs = patterns[selectedCategory] || [];

  const addSegment = () => {
    setPatterns({
      ...patterns,
      [selectedCategory]: [...segs, { durationMs: 50, intensity: 50 }],
    });
  };

  const deleteSegment = (idx) => {
    setPatterns({
      ...patterns,
      [selectedCategory]: segs.filter((_, i) => i !== idx),
    });
  };

  const updateSegment = (idx, field, value) => {
    const updated = segs.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    setPatterns({ ...patterns, [selectedCategory]: updated });
  };

  const resetToDefault = () => {
    setPatterns({ ...patterns, [selectedCategory]: [...DEFAULT_PATTERNS[selectedCategory]] });
  };

  const preview = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.calibration.fire({
      motor: 'N',
      intensity: Math.round((segs[0]?.intensity ?? 80) / 100 * 255),
      waveform: selectedCategory,
    });
  };

  const saveAndFinish = async () => {
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns));
    localStorage.removeItem(STEP_KEY); // reset wizard to step 1 on next visit
    if (window.electronAPI?.calibration?.savePatterns) {
      await window.electronAPI.calibration.savePatterns(patterns);
    }
    alert('Calibration complete! Your patterns have been saved.');
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 4 — Pattern Editor</h2>
      <p className="text-text-muted text-sm mb-5">
        Fine-tune each vibration pattern to your preference. Adjust timing and intensity,
        preview on hardware, then save to complete calibration.
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {WAVEFORMS.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${selectedCategory === cat ? 'bg-accent text-white' : 'bg-muted text-text-muted hover:bg-muted/70'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Waveform canvas */}
      <div className="bg-surface rounded-xl p-4 mb-4">
        <div className="text-xs text-text-muted mb-3">X = time (ms) &nbsp;|&nbsp; Y = intensity (0–100%)</div>
        <WaveformCanvas segments={segs} width={580} height={130} />
      </div>

      {/* Segment list */}
      <div className="flex flex-col gap-2 mb-5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Segments</div>
          <button onClick={addSegment} className="text-xs text-accent hover:underline">+ Add segment</button>
        </div>
        {segs.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-muted rounded-lg px-4 py-3">
            <span className="text-xs text-text-muted w-4">{idx + 1}</span>
            <label className="flex items-center gap-2 text-xs text-text-muted flex-1">
              Duration (ms)
              <input
                type="number" min={5} max={2000} value={seg.durationMs}
                onChange={(e) => updateSegment(idx, 'durationMs', Number(e.target.value))}
                className="bg-surface border border-white/10 rounded px-2 py-1 w-20 text-text outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-text-muted flex-1">
              Intensity (%)
              <input
                type="range" min={0} max={100} value={seg.intensity}
                onChange={(e) => updateSegment(idx, 'intensity', Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="w-8 text-right">{seg.intensity}</span>
            </label>
            <button onClick={() => deleteSegment(idx)} className="text-xs text-danger hover:underline">Delete</button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-text-muted text-sm hover:text-text">← Back</button>
        <div className="flex gap-2">
          <button
            onClick={resetToDefault}
            className="px-4 py-2 bg-muted text-text-muted rounded text-sm hover:bg-muted/70"
          >
            Reset to default
          </button>
          <button
            onClick={preview}
            className="px-4 py-2 bg-surface border border-white/10 text-text rounded text-sm hover:bg-surface/70"
          >
            Preview on hardware
          </button>
          <button
            onClick={saveAndFinish}
            className="px-5 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/80"
          >
            Save & Finish ✓
          </button>
        </div>
      </div>
    </div>
  );
}