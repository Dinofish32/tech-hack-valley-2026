const Direction = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };

const EventCategory = {
  GUNSHOT: 'GUNSHOT',
  FOOTSTEP: 'FOOTSTEP',
  EXPLOSION: 'EXPLOSION',
  ABILITY: 'ABILITY',
  RELOAD: 'RELOAD',
  ALERT: 'ALERT',
  UNKNOWN: 'UNKNOWN',
};

const Priority = { P1: 1, P2: 2, P3: 3, P4: 4 };

const Transport = { WEBSOCKET: 'WEBSOCKET', BLE: 'BLE', NONE: 'NONE' };

const DIRECTION_DEGREES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

const DEFAULT_PRIORITY = {
  GUNSHOT: 1, EXPLOSION: 1, FOOTSTEP: 2,
  ABILITY: 2, RELOAD: 4, ALERT: 3, UNKNOWN: 4,
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
  gunCentroidHz:   1800,  // Hz — centroid above this → gunshot
  gunFlatness:     0.28,  // 0–1 — flatness above this → noise-like (gun)
  gunHighRatio:    0.22,  // fraction of energy in 2–8 kHz band
  gunSubBassMax:   0.22,  // sub-bass fraction below this → not a footstep

  footCentroidHz:  650,   // Hz — centroid below this → footstep
  footSubBassMin:  0.28,  // fraction of energy in 60–350 Hz band
  footHighMax:     0.22,  // high-frequency fraction below this → footstep

  explCentroidMin: 350,   // Hz — explosion centroid range
  explCentroidMax: 2200,
  explFlatness:    0.22,
  explSubBassMin:  0.08,

  abilCentroidMin: 600,   // Hz — ability centroid range
  abilCentroidMax: 3500,
};

module.exports = { Direction, EventCategory, Priority, Transport, DIRECTION_DEGREES, DEFAULT_PRIORITY, SPECTRAL_THRESHOLDS };
