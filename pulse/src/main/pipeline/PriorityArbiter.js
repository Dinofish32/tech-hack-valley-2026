const { EventCategory, DEFAULT_PRIORITY } = require('../../shared/constants');

class PriorityArbiter {
  /**
   * @param {{ staleMs?: number, cooldownMs?: number, footstepDedupeMs?: number }} opts
   */
  constructor({ staleMs = 500, cooldownMs = 100, footstepDedupeMs = 150 } = {}) {
    this.staleMs = staleMs;
    this.cooldownMs = cooldownMs;
    this.footstepDedupeMs = footstepDedupeMs;
    this._priorityMap = { ...DEFAULT_PRIORITY };

    /** @type {Map<string, Array>} */
    this._pendingByDirection = new Map();

    /** @type {Map<string, number>} Last time a P1 event fired per direction */
    this._cooldownByDirection = new Map();

    /** @type {Map<string, number>} Last time a FOOTSTEP fired per direction */
    this._lastFootstepByDirection = new Map();
  }

  /**
   * Submit an AudioEvent for consideration.
   * @param {Object} event AudioEvent
   */
  submit(event) {
    const dir = event.direction;
    if (!this._pendingByDirection.has(dir)) {
      this._pendingByDirection.set(dir, []);
    }
    this._pendingByDirection.get(dir).push(event);
  }

  /**
   * Call every 10ms. Returns events to transmit (max 4 per tick).
   * @returns {Object[]} AudioEvents to transmit
   */
  tick() {
    const now = Date.now();
    const output = [];

    for (const [dir, events] of this._pendingByDirection.entries()) {
      // 1. Remove stale events
      const fresh = events.filter(e => (now - e.timestamp) < this.staleMs);
      this._pendingByDirection.set(dir, fresh);

      if (fresh.length === 0) continue;

      // 2. Sort by priority ascending (lower number = higher priority), then timestamp descending
      const sorted = fresh.slice().sort((a, b) => {
        const pa = this._priorityMap[a.category] || a.priority || 4;
        const pb = this._priorityMap[b.category] || b.priority || 4;
        if (pa !== pb) return pa - pb;
        return b.timestamp - a.timestamp;
      });

      // 3. Select top event
      const top = sorted[0];
      const topPriority = this._priorityMap[top.category] || top.priority || 4;

      // 4. Check P1 cooldown
      const lastCooldown = this._cooldownByDirection.get(dir) || 0;
      if (topPriority === 1 && (now - lastCooldown) < this.cooldownMs) {
        continue;
      }

      // 5. Check footstep dedupe
      if (top.category === EventCategory.FOOTSTEP) {
        const lastFootstep = this._lastFootstepByDirection.get(dir) || 0;
        if ((now - lastFootstep) < this.footstepDedupeMs) {
          continue;
        }
        this._lastFootstepByDirection.set(dir, now);
      }

      // 6. Add to output
      output.push(top);

      // 7. Set cooldown if P1
      if (topPriority === 1) {
        this._cooldownByDirection.set(dir, now);
      }

      // Remove the selected event from pending
      const idx = fresh.indexOf(top);
      if (idx !== -1) fresh.splice(idx, 1);
      this._pendingByDirection.set(dir, fresh);

      // Max 4 events per tick
      if (output.length >= 4) break;
    }

    return output;
  }

  /**
   * Update the category→priority mapping.
   * @param {Object} map
   */
  updatePriorityMap(map) {
    this._priorityMap = { ...this._priorityMap, ...map };
  }

  reset() {
    this._pendingByDirection.clear();
    this._cooldownByDirection.clear();
    this._lastFootstepByDirection.clear();
  }
}

module.exports = PriorityArbiter;
