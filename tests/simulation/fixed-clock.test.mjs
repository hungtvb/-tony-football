import assert from "node:assert/strict";
import test from "node:test";
import { FixedClock } from "../../src/game/core/FixedClock.js";
import { createSeededRandom } from "../../src/game/core/Random.js";
import { gameplayConfig } from "../../src/game/config/gameplayConfig.js";

function simulateFrames(renderFps, seconds) {
  const clock = new FixedClock(gameplayConfig.simulation);
  let updates = 0;
  clock.advance(0, () => { updates += 1; });
  const frameCount = Math.round(renderFps * seconds);
  for (let frame = 1; frame <= frameCount; frame += 1) {
    clock.advance(frame / renderFps, () => { updates += 1; });
  }
  return updates;
}

test("600 fixed ticks equal ten simulation seconds", () => {
  const clock = new FixedClock(gameplayConfig.simulation);
  let elapsed = 0;
  clock.advance(0, () => {});
  for (let tick = 1; tick <= 600; tick += 1) {
    clock.advance(tick / 60, (dt) => { elapsed += dt; });
  }
  assert.ok(Math.abs(elapsed - 10) < 1e-9);
});

for (const fps of [30, 60, 120]) {
  test(`${fps} FPS rendering produces 60 simulation updates per second`, () => {
    assert.equal(simulateFrames(fps, 10), 600);
  });
}

test("large frame deltas are clamped", () => {
  const clock = new FixedClock({ fixedDeltaSeconds: 0.02, maxSubSteps: 10, maxFrameDeltaSeconds: 0.1 });
  let updates = 0;
  clock.advance(0, () => {});
  const result = clock.advance(5, () => { updates += 1; });
  assert.equal(result.frameDeltaSeconds, 0.1);
  assert.equal(updates, 5);
});

test("maximum substeps are respected and excess time is dropped", () => {
  const clock = new FixedClock({ fixedDeltaSeconds: 0.01, maxSubSteps: 3, maxFrameDeltaSeconds: 1 });
  let updates = 0;
  clock.advance(0, () => {});
  const result = clock.advance(0.2, () => { updates += 1; });
  assert.equal(updates, 3);
  assert.equal(result.steps, 3);
  assert.ok(result.droppedSeconds > 0);
  assert.ok(result.alpha >= 0 && result.alpha < 1);
});

test("accumulator remains stable across fractional render frames", () => {
  const clock = new FixedClock(gameplayConfig.simulation);
  clock.advance(0, () => {});
  for (let frame = 1; frame <= 10000; frame += 1) {
    const result = clock.advance(frame / 144, () => {});
    assert.ok(result.alpha >= 0 && result.alpha < 1);
  }
});

test("seeded random sequences are repeatable", () => {
  const first = createSeededRandom("match-1");
  const second = createSeededRandom("match-1");
  assert.deepEqual(
    Array.from({ length: 8 }, () => first.next()),
    Array.from({ length: 8 }, () => second.next()),
  );
});
