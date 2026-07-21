import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserEffectsAdapter } from "../../src/game/presentation/BrowserEffectsAdapter.js";

test("effects adapter owns immutable particle, trail and charge projections", () => {
  const target = {}; const adapter = createBrowserEffectsAdapter({ target, random: () => 0.5 }); adapter.attach();
  assert.equal(adapter.emitParticles({ x: 10, y: 20, particleCount: 3, particleEnergy: 1 }), 3);
  const snapshot = adapter.snapshot(); assert.equal(snapshot.particles.length, 3); assert.equal(adapter.snapshot(), snapshot); assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(snapshot.particles[0]));
  adapter.recordTrail({ x: 7, y: 8 }, { speed: 500 }); adapter.recordTrail({ x: 5, y: 6 }, { speed: 500 });
  const points = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }, { x: 7, y: 8 }]; const trail = adapter.projectTrail(points, { speed: 500 });
  assert.ok(Object.isFrozen(trail)); assert.notEqual(trail[0], points[0]); assert.ok(trail[0].opacity > 0);
  const charge = adapter.projectCharge({ active: true, power: 0.9, player: { x: 4, y: 5 } }); assert.deepEqual(charge, { active: true, power: 0.9, player: { x: 4, y: 5, height: 0 }, color: "#ff5b45" });
  adapter.update(0.1); assert.equal(adapter.reset(), true); assert.equal(adapter.snapshot().particles.length, 0); assert.equal(adapter.teardown(), true);
});

test("effects adapter handles disabled, unavailable and duplicate-owner lifecycle", () => {
  const target = {}; const first = createBrowserEffectsAdapter({ target }); const second = createBrowserEffectsAdapter({ target }); first.attach();
  assert.throws(() => second.attach(), /owner already attached/); first.setEnabled(false); assert.equal(first.emitParticles({ particleCount: 3 }), 0); assert.equal(first.projectTrail([{ x: 1, y: 2 }], { speed: 900 }).length, 0); first.teardown();
});
