const Direction = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };

const EventCategory = {
  GUNSHOT: 'GUNSHOT',
  FOOTSTEP: 'FOOTSTEP',
};

const Priority = { P1: 1, P2: 2, P3: 3, P4: 4 };

const Transport = { WEBSOCKET: 'WEBSOCKET', BLE: 'BLE', NONE: 'NONE' };

const DIRECTION_DEGREES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

const DEFAULT_PRIORITY = {
  GUNSHOT: 1, FOOTSTEP: 2,
};

/**
 * Tunable thresholds for SpectralClassifier.
 * Pass these into Pipeline config as `thresholds` to override defaults.
 *
 * Gunshot vs footstep is the primary binary decision for Valorant.
 * Adjust if you're getting false positives in one direction:
 *   - Too many footsteps misclassified as gunshots → lower gunCentroidHz
 *   - Too many gunshots misclassified as footsteps → raise footCentroidHz
 */
const SPECTRAL_THRESHOLDS = {
  gunCentroidHz:  1800,  // Hz — centroid above this → gunshot
  gunFlatness:    0.28,  // 0–1 — flatness above this → noise-like (gun)
  gunHighRatio:   0.22,  // fraction of energy in 2–8 kHz band
  gunSubBassMax:  0.22,  // sub-bass fraction below this → not a footstep

  footCentroidHz: 650,   // Hz — centroid below this → footstep
  footSubBassMin: 0.28,  // fraction of energy in 60–350 Hz band
  footHighMax:    0.22,  // high-frequency fraction below this → footstep
};

module.exports = { Direction, EventCategory, Priority, Transport, DIRECTION_DEGREES, DEFAULT_PRIORITY, SPECTRAL_THRESHOLDS };
