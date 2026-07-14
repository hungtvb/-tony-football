import test from "node:test";
import assert from "node:assert/strict";
import { createGameFeelController } from "../../src/game/presentation/GameFeelController.js";

test("trail grows with speed and respects low-power cap", () => {
  const desktop = createGameFeelController();
  const lowPower = createGameFeelController({ lowPowerDevice: true });
  assert.equal(desktop.trailPointCount(0), 4);
  assert.ok(desktop.trailPointCount(900) > desktop.trailPointCount(300));
  assert.equal(lowPower.trailPointCount(900), 7);
});

test("trail opacity is zero below threshold and fades with age", () => {
  const feel = createGameFeelController();
  assert.equal(feel.trailOpacity(0, 8, 100), 0);
  assert.ok(feel.trailOpacity(0, 8, 700) > feel.trailOpacity(6, 8, 700));
});

test("airborne shadow becomes smaller and lighter", () => {
  const feel = createGameFeelController();
  const ground = feel.ballShadow(0);
  const airborne = feel.ballShadow(10);
  assert.ok(airborne.scale < ground.scale);
  assert.ok(airborne.opacity < ground.opacity);
});

test("particle budgets scale by device and motion preference", () => {
  assert.equal(createGameFeelController().particleBudget(), 240);
  assert.equal(createGameFeelController({ lowPowerDevice: true }).particleBudget(), 90);
  assert.equal(createGameFeelController({ reducedMotion: true }).particleBudget(), 36);
});

test("reduced motion disables camera offset", () => {
  const feel = createGameFeelController({ reducedMotion: true });
  feel.addImpulse(1, 99);
  assert.deepEqual(feel.sampleCameraOffset(1000), { x: 0, y: 0, z: 0 });
});
