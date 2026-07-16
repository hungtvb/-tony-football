import assert from "node:assert/strict";
import test from "node:test";

import { cameraHudConfig } from "../../src/game/config/cameraHudConfig.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createSnapshotCameraController } from "../../src/game/presentation/SnapshotCameraController.js";

function snapshot({ state = "playing", x = 600, y = 350, vx = 0, vy = 0 } = {}) {
  return createMatchSnapshot({
    tick: 1,
    match: { state },
    players: [],
    ball: { id: "match-ball", ownerId: null, x, y, vx, vy }
  });
}

test("snapshot camera follows immutable ball facts without mutating the snapshot", () => {
  const controller = createSnapshotCameraController({
    worldWidth: 1200,
    worldHeight: 700,
    config: cameraHudConfig.camera
  });
  const source = snapshot({ x: 980, y: 520, vx: 420, vy: 90 });
  const next = controller.update(source, 1 / 60);

  assert.ok(next.x > 600);
  assert.ok(next.y > 350);
  assert.ok(next.targetZoom < cameraHudConfig.camera.baseZoom);
  assert.ok(Object.isFrozen(next));
  assert.equal(source.ball.x, 980);
});

test("snapshot camera recenters from non-match states and exposes reset state", () => {
  const controller = createSnapshotCameraController({
    worldWidth: 1200,
    worldHeight: 700,
    config: cameraHudConfig.camera
  });
  controller.reset({ x: 800, y: 500, zoom: 0.8 });
  const next = controller.update(snapshot({ state: "menu", x: 1100, y: 650 }), 0.5);

  assert.ok(next.x < 800);
  assert.ok(next.y < 500);
  assert.equal(next.targetZoom, cameraHudConfig.camera.baseZoom);
});

test("snapshot camera rejects browser-independent contract mistakes", () => {
  assert.throws(
    () => createSnapshotCameraController({ worldWidth: 0, worldHeight: 700, config: cameraHudConfig.camera }),
    /dimensions/
  );
  const controller = createSnapshotCameraController({ worldWidth: 1200, worldHeight: 700, config: cameraHudConfig.camera });
  assert.throws(() => controller.update(null, 1 / 60), /match snapshot/);
  assert.throws(() => controller.update(snapshot(), -1), /dt/);
});
