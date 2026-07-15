import test from "node:test";
import assert from "node:assert/strict";
import { createGameFeelController } from "../../src/game/presentation/GameFeelController.js";

test("camera easing is frame-rate independent", () => {
  const feel = createGameFeelController();
  const at30 = feel.cameraEase(1 / 30);
  const at60Twice = 1 - (1 - feel.cameraEase(1 / 60)) ** 2;
  assert.ok(Math.abs(at30 - at60Twice) < 1e-12);
});

test("impulse is clamped and decays", () => {
  const feel = createGameFeelController({ camera: { maxImpulse: 1, impulseDecayHz: 8 } });
  assert.equal(feel.addImpulse(2), 1);
  const after = feel.update(0.25);
  assert.ok(after > 0 && after < 1);
});

test("camera noise is deterministic within a frame", () => {
  const feel = createGameFeelController();
  feel.addImpulse(0.7, 42);
  assert.deepEqual(feel.sampleCameraOffset(1000), feel.sampleCameraOffset(1000));
});

test("weak shots do not create a strong-shot impulse", () => {
  const feel = createGameFeelController();
  assert.equal(feel.shotImpulse(0.5), 0);
  assert.ok(feel.shotImpulse(1) > 0.5);
});

test("flash decay never becomes negative", () => {
  const feel = createGameFeelController();
  assert.equal(feel.decayFlash(0.1, 1), 0);
});
