import assert from "node:assert/strict";
import test from "node:test";

import { cameraHudConfig } from "../../src/game/config/cameraHudConfig.js";
import {
  cameraFrameTarget,
  cameraLookAhead,
  cameraZoomForSpeed,
  deadZoneTarget,
} from "../../src/game/presentation/CameraFraming.js";

const config = cameraHudConfig.camera;

test("camera zooms out as ball speed increases", () => {
  const slow = cameraZoomForSpeed(80, config);
  const fast = cameraZoomForSpeed(700, config);
  assert.ok(fast < slow);
  assert.ok(fast >= config.minZoom);
});

test("stationary subject produces no look-ahead", () => {
  assert.deepEqual(cameraLookAhead(0, 0, config), { x: 0, y: 0 });
});

test("look-ahead follows velocity and stays capped", () => {
  const result = cameraLookAhead(1000, 0, config);
  assert.equal(result.y, 0);
  assert.equal(result.x, config.lookAheadMax);
});

test("dead zone prevents constant camera drift", () => {
  const result = deadZoneTarget({ cameraX: 600, cameraY: 350, subjectX: 650, subjectY: 380, config });
  assert.deepEqual(result, { x: 600, y: 350 });
});

test("subject outside dead zone moves only the required amount", () => {
  const result = deadZoneTarget({ cameraX: 600, cameraY: 350, subjectX: 800, subjectY: 350, config });
  assert.equal(result.x, 800 - config.deadZoneX);
  assert.equal(result.y, 350);
});

test("safe-area framing remains inside world bounds", () => {
  const frame = cameraFrameTarget({
    cameraX: 600,
    cameraY: 350,
    subjectX: 1190,
    subjectY: 690,
    velocityX: 500,
    velocityY: 300,
    worldWidth: 1200,
    worldHeight: 700,
    viewportWidth: 1200,
    viewportHeight: 700,
    zoom: 1,
    config,
  });
  assert.ok(frame.x <= 1200);
  assert.ok(frame.y <= 700);
  assert.ok(Number.isFinite(frame.x));
  assert.ok(Number.isFinite(frame.y));
});
