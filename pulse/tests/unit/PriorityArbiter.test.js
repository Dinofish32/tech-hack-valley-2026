const PriorityArbiter = require('../../src/main/pipeline/PriorityArbiter');
const { Direction, EventCategory } = require('../../src/shared/constants');

function makeEvent(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    direction: Direction.N,
    category: EventCategory.GUNSHOT,
    confidence: 0.9,
    intensityRms: 0.5,
    priority: 1,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('PriorityArbiter', () => {
  it('tick() returns P1 event when both P1 and P3 submitted for same direction', () => {
    const arb = new PriorityArbiter({ cooldownMs: 0 });
    const p1 = makeEvent({ direction: Direction.N, category: EventCategory.GUNSHOT, priority: 1 });
    const p3 = makeEvent({ direction: Direction.N, category: EventCategory.ALERT, priority: 3, timestamp: Date.now() + 1 });
    arb.submit(p3);
    arb.submit(p1);
    const results = arb.tick();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe(EventCategory.GUNSHOT);
  });

  it('discards stale events (older than staleMs)', async () => {
    const arb = new PriorityArbiter({ staleMs: 50, cooldownMs: 0 });
    const old = makeEvent({ timestamp: Date.now() - 200 });
    arb.submit(old);
    const results = arb.tick();
    expect(results.filter(e => e.id === old.id).length).toBe(0);
  });

  it('returns at most 4 events per tick', () => {
    const arb = new PriorityArbiter({ cooldownMs: 0 });
    const dirs = [Direction.N, Direction.E, Direction.S, Direction.W, Direction.NE, Direction.SE];
    for (const d of dirs) {
      arb.submit(makeEvent({ direction: d }));
    }
    const results = arb.tick();
    expect(results.length).toBeLessThanOrEqual(4);
  });

  it('footstep dedupe suppresses rapid repeated footsteps', () => {
    const arb = new PriorityArbiter({ footstepDedupeMs: 500, cooldownMs: 0 });
    const f1 = makeEvent({ category: EventCategory.FOOTSTEP, direction: Direction.S, priority: 2 });
    arb.submit(f1);
    arb.tick(); // first footstep transmits
    const f2 = makeEvent({ category: EventCategory.FOOTSTEP, direction: Direction.S, priority: 2 });
    arb.submit(f2);
    const results = arb.tick();
    expect(results.filter(e => e.category === EventCategory.FOOTSTEP && e.direction === Direction.S).length).toBe(0);
  });

  it('updatePriorityMap changes arbitration order', () => {
    const arb = new PriorityArbiter({ cooldownMs: 0 });
    // Make FOOTSTEP P1 (higher priority than GUNSHOT P2)
    arb.updatePriorityMap({ FOOTSTEP: 1, GUNSHOT: 2 });
    const footstep = makeEvent({ category: EventCategory.FOOTSTEP, direction: Direction.W, priority: 1 });
    const gunshot = makeEvent({ category: EventCategory.GUNSHOT, direction: Direction.W, priority: 2, timestamp: Date.now() + 1 });
    arb.submit(gunshot);
    arb.submit(footstep);
    const results = arb.tick();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe(EventCategory.FOOTSTEP);
  });

  it('reset clears all pending events', () => {
    const arb = new PriorityArbiter({ cooldownMs: 0 });
    arb.submit(makeEvent());
    arb.reset();
    const results = arb.tick();
    expect(results.length).toBe(0);
  });
});
