import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot, createSnapshotFrame } from "../../src/game/engine/MatchSnapshot.js";
import {
  createSnapshotRenderState,
  interpolateRenderAngle
} from "../../src/game/presentation/SnapshotRenderState.js";

function snapshot(tick, { player = {}, ball = {} } = {}) {
  return createMatchSnapshot({
    tick,
    match: { state: "playing", selectedPlayerId: "home-4" },
    players: [{
      id: "home-4",
      team: 0,
      x: 100,
      y: 200,
      vx: 60,
      vy: 0,
      dirX: 1,
      dirY: 0,
      motionYaw: Math.PI / 2,
      turnLean: 0,
      strideBlend: 0.4,
      stepPhase: 1,
      anim: "idle",
      animTime: 0,
      ...player
    }],
    ball: {
      id: "match-ball",
      ownerId: "home-4",
      x: 120,
      y: 200,
      vx: 60,
      vy: 0,
      height: 0,
      vz: 0,
      angle: 0,
      spin: 0,
      ...ball
    }
  });
}

test("render state interpolates player and ball transforms without mutating snapshots", () => {
  const previous = snapshot(10);
  const current = snapshot(11, {
    player: { x: 104, y: 202, vx: 120, vy: 30, stepPhase: 1.6, turnLean: 0.2 },
    ball: { x: 126, y: 204, height: 1.2, angle: 0.8, spin: 3 }
  });

  const state = createSnapshotRenderState(createSnapshotFrame(previous, current, 0.5));

  assert.equal(state.players[0].x, 102);
  assert.equal(state.players[0].y, 201);
  assert.equal(state.players[0].vx, 90);
  assert.equal(state.players[0].stepPhase, 1.3);
  assert.equal(state.ball.x, 123);
  assert.equal(state.ball.y, 202);
  assert.equal(state.ball.height, 0.6);
  assert.equal(state.ball.angle, 0.4);
  assert.equal(previous.players[0].x, 100);
  assert.equal(current.players[0].x, 104);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.players));
  assert.ok(Object.isFrozen(state.players[0]));
});

test("render angles take the shortest path across the pi boundary", () => {
  const from = Math.PI - 0.1;
  const to = -Math.PI + 0.1;
  const halfway = interpolateRenderAngle(from, to, 0.5);

  assert.ok(Math.abs(Math.abs(halfway) - Math.PI) < 1e-9);

  const previous = snapshot(20, { player: { dirX: Math.sin(from), dirY: Math.cos(from), motionYaw: from } });
  const current = snapshot(21, { player: { dirX: Math.sin(to), dirY: Math.cos(to), motionYaw: to } });
  const state = createSnapshotRenderState(createSnapshotFrame(previous, current, 0.5));
  assert.ok(Math.abs(Math.hypot(state.players[0].dirX, state.players[0].dirY) - 1) < 1e-9);
  assert.ok(Math.abs(Math.abs(state.players[0].motionYaw) - Math.PI) < 1e-9);
});

test("same-tick resets and large teleports snap to current transforms", () => {
  const previous = snapshot(30);
  const sameTick = snapshot(30, { player: { x: 900 }, ball: { x: 980 } });
  const resetState = createSnapshotRenderState(createSnapshotFrame(previous, sameTick, 0.25));
  assert.equal(resetState.players[0], sameTick.players[0]);
  assert.equal(resetState.ball, sameTick.ball);

  const teleported = snapshot(31, { player: { x: 900 }, ball: { x: 980 } });
  const teleportState = createSnapshotRenderState(createSnapshotFrame(previous, teleported, 0.5));
  assert.equal(teleportState.players[0].x, 900);
  assert.equal(teleportState.ball.x, 980);
});

test("discrete animation and ownership facts come from the current snapshot", () => {
  const previous = snapshot(40, { player: { anim: "idle", animTime: 0 }, ball: { ownerId: "home-4" } });
  const current = snapshot(41, { player: { anim: "shoot", animTime: 0.3 }, ball: { ownerId: null } });
  const state = createSnapshotRenderState(createSnapshotFrame(previous, current, 0.2));

  assert.equal(state.players[0].anim, "shoot");
  assert.equal(state.players[0].animTime, 0.3);
  assert.equal(state.ball.ownerId, null);
});
