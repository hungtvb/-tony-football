import test from "node:test";
import assert from "node:assert/strict";
import { createContextualParticlePolicy } from "../../src/game/presentation/ContextualParticlePolicy.js";

test("selects rain particles before pitch style", () => {
  const policy = createContextualParticlePolicy();
  assert.equal(policy.contextFor({ weather: "rain", pitchStyle: "dry" }), "rain");
});

test("selects dust particles on dry pitch", () => {
  const policy = createContextualParticlePolicy();
  assert.equal(policy.contextFor({ weather: "clear", pitchStyle: "dry" }), "dust");
});

test("defaults to grass particles", () => {
  const policy = createContextualParticlePolicy();
  assert.equal(policy.contextFor(), "grass");
});

test("higher energy produces a larger bounded burst", () => {
  const policy = createContextualParticlePolicy();
  const light = policy.burst({ energy: 0.25 });
  const strong = policy.burst({ energy: 3 });
  assert.ok(strong.count > light.count);
  assert.ok(strong.count <= 21);
});

test("low-power and reduced-motion modes reduce burst size", () => {
  const desktop = createContextualParticlePolicy().burst({ energy: 2 });
  const lowPower = createContextualParticlePolicy({ lowPowerDevice: true }).burst({ energy: 2 });
  const reduced = createContextualParticlePolicy({ reducedMotion: true }).burst({ energy: 2 });
  assert.ok(lowPower.count < desktop.count);
  assert.ok(reduced.count < lowPower.count);
});
