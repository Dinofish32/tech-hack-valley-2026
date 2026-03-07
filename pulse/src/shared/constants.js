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

module.exports = { Direction, EventCategory, Priority, Transport, DIRECTION_DEGREES, DEFAULT_PRIORITY };
