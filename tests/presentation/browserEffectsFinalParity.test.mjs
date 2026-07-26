import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserEffectsAdapter } from "../../src/game/presentation/BrowserEffectsAdapter.js";

test("one frozen effects projection is reusable by WebGL and Canvas consumers", () => {
  const adapter = createBrowserEffectsAdapter({ target: {}, random: () => .25 });
  assert.equal(adapter.attach(), true);
  adapter.recordTrail({ x: 610, y: 340, height: 2 }, { speed: 180 });
  adapter.emitParticles({ x: 600, y: 350, particleCount: 2, particleColor: "#fff", particleEnergy: 1 });
  const player = Object.freeze({ id: "p1", x: 500, y: 320, height: 0 });
  const snapshot = Object.freeze({ ball: Object.freeze({ vx: 180, vy: 0 }), match: Object.freeze({ selectedPlayerId: "p1" }) });
  const frame = Object.freeze({ snapshot, renderState: Object.freeze({ players: Object.freeze([player]) }), activeCharge: Object.freeze({ power: .9 }) });
  const webglFrame = adapter.projectFrame(frame); const canvasFrame = adapter.projectFrame(frame);
  assert.equal(webglFrame, canvasFrame);
  assert.ok(Object.isFrozen(webglFrame.effects));
  assert.ok(Object.isFrozen(webglFrame.effects.particles));
  assert.ok(Object.isFrozen(webglFrame.effects.trail));
  assert.equal(webglFrame.effects.particles.length, 2);
  assert.equal(webglFrame.effects.trail.length, 1);
  assert.equal(webglFrame.effects.charge.active, true);
  assert.equal(webglFrame.effects.charge.color, "#ff5b45");
});
