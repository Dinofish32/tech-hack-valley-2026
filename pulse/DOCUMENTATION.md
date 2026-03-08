# Puls8 — Technical Documentation

## 1. Problem Addressed

Competitive gaming demands rapid spatial awareness. Players rely entirely on visual and audio cues to locate threats such as enemy footsteps and gunshots — but audio directional cues are subtle, require headphones to interpret, and are completely inaccessible to deaf or hard-of-hearing players. Even for hearing players, high-stress situations make it easy to miss critical audio information.

**Puls8** addresses this by translating real-time game audio into directional haptic (vibration/LED) feedback delivered through a wearable headband. When a gunshot fires to the East or footsteps approach from the North, the corresponding motor or LED on the headband activates — giving the player an instant, intuitive, physical sense of direction without relying solely on ears or screen indicators.

---

## 2. Solution Approach

The system is divided into three layers:

### Layer 1 — PC Software (Electron App)
A desktop application captures system audio in real time, runs a signal processing and classification pipeline to detect and localise game sound events, and transmits compact 8-byte motor command packets over USB serial.

### Layer 2 — USB Dongle (ESP32)
A small ESP32 microcontroller plugged into the PC receives the serial packets and re-transmits them wirelessly to the headband using ESP-NOW — a low-latency peer-to-peer Wi-Fi protocol designed for embedded devices.

### Layer 3 — Headband (ESP32-C6)
A second ESP32 worn on the head receives the ESP-NOW packets and drives up to 8 output channels (4 directions × 2 event types) via PWM — activating the correct motor or LED for the detected direction and sound category.

The end-to-end target latency is under 50 ms from audio onset to haptic output.

---

## 3. Implementation Details

### 3.1 Audio Capture

The PC application uses **node-portaudio** with WASAPI loopback to capture the system's audio output — whatever the game is playing — without requiring any changes to the game itself. On systems where portaudio is unavailable (e.g. during development on Linux/WSL), the pipeline falls back to synthetic audio so the rest of the stack can be tested.

### 3.2 Signal Processing Pipeline

The pipeline runs as a Node.js event-driven system inside Electron's main process. Each audio buffer passes through the following stages in sequence:

| Stage | Module | Purpose |
|---|---|---|
| Audio Capture | `AudioCapture.js` | WASAPI loopback at 48 kHz, 512-sample buffers |
| Onset Detection | `OnsetDetector.js` | Detects transient energy spikes indicating a sound event |
| STFT | `STFT.js` | Short-Time Fourier Transform — converts time-domain audio to frequency domain |
| Source Separation | `SourceSeparator.js` | NMF-based separation to isolate foreground events from background noise |
| Direction Decoding | `DirectionDecoder.js` | Determines 8-point compass direction from stereo audio cues |
| Classification | `Classifier.js` | Classifies event as GUNSHOT or FOOTSTEP |
| Priority Arbitration | `PriorityArbiter.js` | Resolves conflicts when multiple simultaneous events are detected |
| Command Generation | `MotorCommandGenerator.js` | Converts event + direction into PWM intensities per motor |

The pipeline emits real-time metrics (latency percentiles, events/sec, suppression rate) and automatically switches to a lightweight processing mode if average latency exceeds 50 ms.

### 3.3 Direction Decoding

Direction is computed from two independent stereo cues:

- **ILD (Interaural Level Difference):** The RMS energy ratio between left and right audio channels determines whether the sound is coming from the left or right side.
- **HF Spectral Slope:** The ratio of high-frequency energy (6–12 kHz) to broadband energy (2–12 kHz) determines front vs back. Sounds coming from behind have reduced high-frequency content due to acoustic shadowing by the head (Head-Related Transfer Function).

These two axes — left/right and front/back — are combined to produce an 8-point compass direction (N, NE, E, SE, S, SW, W, NW) with associated confidence values.

### 3.4 Classification

Two event categories are supported:

- **GUNSHOT** — characterised by high spectral centroid, high spectral flatness (broad noise-like spectrum), and a sharp transient onset
- **FOOTSTEP** — characterised by lower centroid frequency and a softer, more tonal envelope

The classifier uses spectral features extracted from the STFT output. When a trained ONNX model (`mobilenet_classifier.onnx`) is present, it is used for inference via `onnxruntime-node`. Otherwise the system falls back to a rule-based spectral classifier using the thresholds defined in `constants.js`.

### 3.5 Motor Command Generation

Once a direction and category are known, the `MotorCommandGenerator` maps the 8-point direction to cosine-blended intensities across four motor channels (N, E, S, W). For example, a sound from the NE would activate both N and E motors at reduced intensity.

Intensity is scaled logarithmically from the RMS energy of the detected onset:

```
intensity = log10(1 + 9 × RMS) × 255
```

This compression mimics human loudness perception and prevents full-strength activations for quiet sounds.

### 3.6 Packet Protocol

All commands are serialised into a compact 8-byte binary packet:

| Byte | Field | Description |
|---|---|---|
| 0 | Motor N | PWM intensity 0–255 |
| 1 | Motor E | PWM intensity 0–255 |
| 2 | Motor S | PWM intensity 0–255 |
| 3 | Motor W | PWM intensity 0–255 |
| 4 | Waveform ID | 0x00 = GUNSHOT, 0x01 = FOOTSTEP, 0xFF = STOP |
| 5 | Duration (high byte) | Milliseconds the motors stay active |
| 6 | Duration (low byte) | |
| 7 | XOR Checksum | XOR of bytes 0–6 for integrity |

The fixed 8-byte size and XOR checksum allow the dongle to re-synchronise automatically if bytes are lost in transit, by dropping one byte at a time until a valid checksum is found.

### 3.7 USB Dongle Firmware

The dongle ESP32 (`dongle/src/main.cpp`) operates as a transparent bridge:

1. Reads bytes from USB serial at 115200 baud into a rolling buffer
2. When 8 bytes are buffered, validates the XOR checksum
3. On success, forwards the packet via ESP-NOW to the headband's MAC address
4. On failure, drops one byte and retries (re-sync)

ESP-NOW is used for the wireless link because it operates independently of Wi-Fi infrastructure, has ~1 ms over-the-air latency, and does not require the headband to be connected to any network.

### 3.8 Headband Firmware

The headband ESP32-C6 (`pulse_firmware/pulse_firmware.ino`) receives ESP-NOW packets and drives the output hardware:

- 8 PWM channels are configured via the ESP32 LEDC peripheral (5 kHz, 8-bit resolution)
- On packet receipt, the firmware validates the checksum, logs the packet to Serial, and writes PWM values to the appropriate pins
- GUNSHOT events activate the second set of pins (`PIN_x[1]`); FOOTSTEP events activate the first set (`PIN_x[0]`)
- A duration timer in `loop()` automatically turns all outputs off after the command's `durationMs` expires
- A 500 ms failsafe cuts all outputs if no packets are received, preventing stuck activations

**Pin layout:**

| Direction | Footstep Pin | Gunshot Pin |
|---|---|---|
| North | GPIO 6 | GPIO 7 |
| South | GPIO 18 | GPIO 19 |
| East | GPIO 2 | GPIO 3 |
| West | GPIO 4 | GPIO 5 |

### 3.9 Desktop Application

The Electron application provides:

- **Dashboard** — real-time headband visualiser, pipeline metrics, and a manual simulation panel for testing directions and event types without game audio
- **Settings** — COM port selection, audio device selection, and transport configuration
- **Calibration** — per-motor test firing to verify hardware connections
- **Event Log** — timestamped record of all detected events with direction, category, confidence, and latency
- **Profiles** — per-game configuration for sensitivity and enabled event categories

The renderer (React + Zustand) communicates with the main process exclusively through a contextBridge IPC interface, keeping Node.js APIs isolated from the renderer sandbox.

### 3.10 Technology Stack

| Layer | Technology |
|---|---|
| Desktop app | Electron 40, React 18, Tailwind CSS 3 |
| State management | Zustand |
| Audio capture | node-portaudio (WASAPI loopback) |
| Signal processing | fft.js, custom NMF |
| ML inference | onnxruntime-node |
| Database | better-sqlite3 (WAL mode) |
| Serial communication | serialport (native, rebuilt for Electron ABI) |
| Wireless protocol | ESP-NOW (peer-to-peer, ~1 ms latency) |
| Microcontroller firmware | Arduino framework via PlatformIO, ESP-IDF 5.x |
| Build system | electron-forge + webpack |
