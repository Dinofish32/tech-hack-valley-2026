import React, { useState } from 'react';

const MOTORS = ['N', 'E', 'S', 'W'];
const MOTOR_LABELS = { N: 'North', E: 'East', S: 'South', W: 'West' };

const WAVEFORMS = ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'ABILITY', 'ALERT', 'RELOAD'];

export default function Calibration() {
  const [step, setStep] = useState(1);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-2">Calibration</h1>
      <p className="text-text-muted text-sm mb-6">3-step wizard to configure your Pulse8 headband.</p>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-accent' : 'bg-muted'}`} />
        ))}
      </div>

      {step === 1 && <Step1 onNext={() => setStep(2)} />}
      {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <Step3 onBack={() => setStep(2)} />}
    </div>
  );
}

function Step1({ onNext }) {
  const [intensities, setIntensities] = useState({ N: 200, E: 200, S: 200, W: 200 });
  const [confirmed, setConfirmed] = useState({});

  const fire = async (motor) => {
    if (!window.electronAPI) return;
    await window.electronAPI.calibration.fire({
      motor,
      intensity: intensities[motor],
      waveform: 'ALERT',
    });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 1 — Motor Test</h2>
      <p className="text-text-muted text-sm mb-5">Fire each motor one at a time. Adjust intensity until you can clearly feel it.</p>
      {MOTORS.map((m) => (
        <div key={m} className="flex items-center gap-4 mb-4 bg-muted rounded-lg px-4 py-3">
          <span className="font-bold w-16">{MOTOR_LABELS[m]}</span>
          <input type="range" min={50} max={255} value={intensities[m]}
            onChange={(e) => setIntensities({ ...intensities, [m]: Number(e.target.value) })}
            className="flex-1 accent-accent" />
          <span className="text-xs text-text-muted w-8">{intensities[m]}</span>
          <button onClick={() => fire(m)} className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:bg-accent/80">Fire</button>
          <button
            onClick={() => setConfirmed({ ...confirmed, [m]: true })}
            className={`px-3 py-1.5 rounded text-xs ${confirmed[m] ? 'bg-success/20 text-success' : 'bg-muted text-text-muted border border-muted'}`}
          >{confirmed[m] ? '✓ Felt' : 'I feel it'}</button>
        </div>
      ))}
      <button onClick={onNext}
        disabled={Object.keys(confirmed).length < 4}
        className="mt-4 px-5 py-2 bg-accent text-white rounded-lg text-sm disabled:opacity-40 hover:bg-accent/80">
        Next →
      </button>
    </div>
  );
}

function Step2({ onNext, onBack }) {
  const [responses, setResponses] = useState([]);
  const [current, setCurrent] = useState(0);
  const SAMPLES = 5; // simplified: 5 rounds of front/back

  const respond = (isFront) => {
    const updated = [...responses, isFront];
    setResponses(updated);
    if (updated.length >= SAMPLES) {
      const frontCount = updated.filter(Boolean).length;
      const accuracy = Math.round((frontCount / SAMPLES) * 100);
      alert(`Calibration complete!\nFront accuracy: ${accuracy}%\nHF threshold will be saved.`);
      onNext();
    } else {
      setCurrent(updated.length);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 2 — Front/Back Threshold</h2>
      <p className="text-text-muted text-sm mb-5">
        Listen carefully and indicate if the sound feels like it came from the front or back.
        ({current + 1} / {SAMPLES})
      </p>
      <div className="bg-muted rounded-xl p-8 text-center mb-6">
        <div className="text-text-muted text-sm mb-4">Playing sample {current + 1}...</div>
        <div className="text-4xl mb-6">🔊</div>
        <div className="flex gap-4 justify-center">
          <button onClick={() => respond(true)} className="px-6 py-3 bg-accent text-white rounded-lg text-sm hover:bg-accent/80">Front</button>
          <button onClick={() => respond(false)} className="px-6 py-3 bg-muted border border-muted text-text rounded-lg text-sm hover:bg-muted/70">Back</button>
        </div>
      </div>
      <button onClick={onBack} className="text-text-muted text-sm hover:text-text">← Back</button>
    </div>
  );
}

function Step3({ onBack }) {
  const [current, setCurrent] = useState(0);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 3 — Pattern Training</h2>
      <p className="text-text-muted text-sm mb-5">
        Feel each vibration pattern and memorize what it represents. No input needed — just read and feel.
      </p>
      <div className="bg-muted rounded-xl p-6 text-center mb-4">
        <div className="text-2xl font-bold text-accent mb-2">{WAVEFORMS[current]}</div>
        <div className="text-text-muted text-sm mb-4">Playing waveform pattern...</div>
        <div className="text-4xl">📳</div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button onClick={onBack} className="text-text-muted text-sm hover:text-text">← Back</button>
        <div className="text-xs text-text-muted">{current + 1} / {WAVEFORMS.length}</div>
        {current < WAVEFORMS.length - 1 ? (
          <button onClick={() => setCurrent(current + 1)} className="px-5 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/80">Next →</button>
        ) : (
          <div className="text-success text-sm font-semibold">✓ Complete!</div>
        )}
      </div>
    </div>
  );
}
