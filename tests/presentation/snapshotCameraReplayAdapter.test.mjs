import assert from "node:assert/strict";
import test from "node:test";

import { cameraHudConfig } from "../../src/game/config/cameraHudConfig.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createSnapshotCameraReplayAdapter } from "../../src/game/presentation/SnapshotCameraReplayAdapter.js";

function snapshot(tick, {
  elapsed = tick / 10,
  state = "playing",
  replayActive = false,
  replayElapsed = 0,
  replayDuration = 2,
  goalSequence = null,
  ballX = 300 + tick * 10,
  ballY = 350,
  score = [0, 0],
  time = 150 - elapsed,
} = {}) {
  return createMatchSnapshot({
    tick,
    match: {
      state, elapsed, time, score, selectedPlayerId: "home-0",
      settings: { pitchStyle: "classic", ballStyle: "classic", weather: "clear" },
      replay: { active: replayActive, elapsed: replayElapsed, duration: replayDuration },
      goalSequence,
    },
    players: [
      { id: "home-0", team: 0, index: 0, role: "FW", x: 300, y: 350, vx: 0, vy: 0 },
      { id: "away-0", team: 1, index: 0, role: "GK", x: 1000, y: 350, vx: 0, vy: 0 },
    ],
    ball: { id: "match-ball", x: ballX, y: ballY, vx: 120, vy: 0, radius: 9, ownerId: null, trail: [], possession: { state: "loose" } },
  });
}
function goalSequence({ team = 0, scorerId = "home-0", phase = "celebrate", elapsed = 0, duration = 4 } = {}) {
  return { team, scorerId, phase, elapsed, duration };
}
function frame(current, previous = current, nowMilliseconds = current.tick * 100) {
  return Object.freeze({ snapshot: current, previousSnapshot: previous, alpha: 1, nowMilliseconds, cameraMode: "broadcast" });
}
function adapter(options = {}) {
  return createSnapshotCameraReplayAdapter({ worldWidth: 1200, worldHeight: 700, viewportWidth: 1200, viewportHeight: 700, cameraConfig: cameraHudConfig.camera, sampleRate: 10, maxFrames: 8, ...options });
}

test("records normal play and projects camera without mutating snapshots", () => {
  const owner = adapter(); assert.equal(owner.attach(), true);
  const first = snapshot(1, { elapsed: .1, ballX: 320 }); const second = snapshot(2, { elapsed: .2, ballX: 360 });
  const projection = owner.project(frame(second, first, 200));
  assert.equal(projection.snapshot, second); assert.equal(projection.renderSnapshot, second); assert.equal(projection.replay.active, false);
  assert.equal(owner.diagnostics().replay.historyFrames, 1); assert.ok(Number.isFinite(projection.camera.x)); assert.equal(Object.isFrozen(projection), true); assert.equal(second.ball.x, 360);
});

test("selects replay visuals from authoritative engine elapsed and never advances time locally", () => {
  const owner = adapter(); owner.attach();
  const live1 = snapshot(1, { elapsed: .1, ballX: 310 }); const live2 = snapshot(2, { elapsed: .2, ballX: 410 }); const live3 = snapshot(3, { elapsed: .3, ballX: 510 });
  owner.project(frame(live1)); owner.project(frame(live2, live1)); owner.project(frame(live3, live2));
  const replayStart = snapshot(4, { elapsed: .3, replayActive: true, replayElapsed: 0, replayDuration: 2, ballX: 900 });
  const startProjection = owner.project(frame(replayStart, live3, 400));
  assert.equal(startProjection.replay.active, true); assert.equal(startProjection.replay.elapsed, 0); assert.equal(startProjection.replaySnapshot.tick, 1);
  assert.equal(owner.replay.update(99), false); assert.equal(owner.replay.elapsed, 0);
  const replayLater = snapshot(5, { elapsed: .3, replayActive: true, replayElapsed: 1.5, replayDuration: 2, ballX: 900 });
  const laterProjection = owner.project(frame(replayLater, replayStart, 500));
  assert.equal(laterProjection.replay.elapsed, 1.5); assert.equal(laterProjection.replaySnapshot.tick, 3); assert.equal(owner.replay.update(99), false); assert.equal(owner.replay.elapsed, 1.5);
});

test("captures the active scoring incident from pre-shot through goal aftermath", () => {
  const owner = adapter({ maxFrames: 10 }); owner.attach();
  const preShot = snapshot(1, { elapsed: .1, ballX: 110 });
  const shot = snapshot(2, { elapsed: .2, ballX: 260 });
  const goal = snapshot(3, { elapsed: .2, ballX: 1130, score: [1, 0], goalSequence: goalSequence({ phase: "flash", elapsed: 0 }) });
  const celebrate = snapshot(4, { elapsed: .2, ballX: 1140, score: [1, 0], goalSequence: goalSequence({ phase: "celebrate", elapsed: .5 }) });
  const aftermath = snapshot(5, { elapsed: .2, ballX: 1150, score: [1, 0], goalSequence: goalSequence({ phase: "highlight", elapsed: 1 }) });
  owner.project(frame(preShot)); owner.project(frame(shot, preShot)); owner.project(frame(goal, shot)); owner.project(frame(celebrate, goal)); owner.project(frame(aftermath, celebrate));
  const replayStart = snapshot(6, { elapsed: .2, ballX: 700, score: [1, 0], replayActive: true, replayElapsed: 0, replayDuration: 2, goalSequence: goalSequence({ phase: "replay", elapsed: 1.2 }) });
  const projection = owner.project(frame(replayStart, aftermath));
  const evidence = owner.diagnostics().replay;
  assert.equal(projection.replay.incidentKey, "1:0:0:home-0");
  assert.deepEqual(evidence.playbackFrameTicks, [1, 2, 3, 4, 5]);
  assert.equal(projection.replaySnapshot.tick, 1);
  const mid = snapshot(7, { elapsed: .2, score: [1, 0], replayActive: true, replayElapsed: 1.1, replayDuration: 2, goalSequence: goalSequence({ phase: "replay", elapsed: 2 }) });
  assert.equal(owner.project(frame(mid, replayStart)).replaySnapshot.tick, 3);
  const end = snapshot(8, { elapsed: .2, score: [1, 0], replayActive: true, replayElapsed: 1.99, replayDuration: 2, goalSequence: goalSequence({ phase: "replay", elapsed: 3 }) });
  assert.equal(owner.project(frame(end, mid)).replaySnapshot.tick, 5);
});

test("a later goal cannot replay frames from the prior scoring incident", () => {
  const owner = adapter({ maxFrames: 12 }); owner.attach();
  const firstLive = snapshot(1, { elapsed: .1, ballX: 120 }); const firstGoal = snapshot(2, { elapsed: .1, ballX: 1130, score: [1, 0], goalSequence: goalSequence({ phase: "flash" }) });
  const firstAftermath = snapshot(3, { elapsed: .1, ballX: 1140, score: [1, 0], goalSequence: goalSequence({ phase: "highlight" }) });
  const firstReplay = snapshot(4, { elapsed: .1, score: [1, 0], replayActive: true, goalSequence: goalSequence({ phase: "replay" }) });
  owner.project(frame(firstLive)); owner.project(frame(firstGoal, firstLive)); owner.project(frame(firstAftermath, firstGoal)); owner.project(frame(firstReplay, firstAftermath));
  const kickoff = snapshot(5, { elapsed: .1, score: [1, 0], ballX: 600 }); owner.project(frame(kickoff, firstReplay));
  const secondLive1 = snapshot(10, { elapsed: .2, score: [1, 0], ballX: 220 }); const secondLive2 = snapshot(11, { elapsed: .3, score: [1, 0], ballX: 420 });
  const secondGoal = snapshot(12, { elapsed: .3, score: [2, 0], ballX: 1135, goalSequence: goalSequence({ phase: "flash" }) });
  const secondAftermath = snapshot(13, { elapsed: .3, score: [2, 0], ballX: 1145, goalSequence: goalSequence({ phase: "highlight" }) });
  const secondReplay = snapshot(14, { elapsed: .3, score: [2, 0], replayActive: true, goalSequence: goalSequence({ phase: "replay" }) });
  owner.project(frame(secondLive1, kickoff)); owner.project(frame(secondLive2, secondLive1)); owner.project(frame(secondGoal, secondLive2)); owner.project(frame(secondAftermath, secondGoal));
  const projection = owner.project(frame(secondReplay, secondAftermath)); const evidence = owner.diagnostics().replay;
  assert.equal(projection.replay.incidentKey, "2:0:0:home-0");
  assert.deepEqual(evidence.playbackFrameTicks, [5, 10, 11, 12, 13]);
  assert.equal(evidence.playbackFrameTicks.some((tick) => tick >= 1 && tick <= 4), false);
  assert.equal(projection.replaySnapshot.tick, 5);
});

test("historical replay visuals preserve current engine-owned metadata", () => {
  const owner = adapter(); owner.attach();
  const historical = snapshot(1, { elapsed: .1, ballX: 321, score: [0, 0], time: 149.9 }); const beforeReplay = snapshot(2, { elapsed: .2, ballX: 421, score: [0, 0], time: 149.8 });
  owner.project(frame(historical)); owner.project(frame(beforeReplay, historical));
  const current = snapshot(3, { elapsed: .2, replayActive: true, replayElapsed: 0, replayDuration: 2, ballX: 999, score: [1, 0], time: 147.25, goalSequence: goalSequence({ phase: "replay" }) });
  const projection = owner.project(frame(current, beforeReplay));
  assert.equal(projection.renderSnapshot.match, current.match); assert.deepEqual(projection.renderSnapshot.match.score, [1, 0]); assert.equal(projection.renderSnapshot.match.time, 147.25); assert.equal(projection.renderSnapshot.match.replay.active, true); assert.equal(projection.renderSnapshot.ball.x, historical.ball.x);
});

test("compatibility replay facade cannot activate or advance replay", () => {
  const owner = adapter(); owner.attach();
  assert.equal("start" in owner.replay, false); assert.equal("loadFrames" in owner.replay, false); assert.equal("syncElapsed" in owner.replay, false);
  owner.project(frame(snapshot(1))); assert.equal(owner.replay.active, false); assert.equal(owner.replay.update(500), false); assert.equal(owner.replay.active, false);
});

test("skip returns immediately to the live snapshot", () => {
  const owner = adapter(); owner.attach(); const live = snapshot(1, { elapsed: .1 }); owner.project(frame(live));
  const replay = snapshot(2, { elapsed: .1, replayActive: true, replayElapsed: .5 }); owner.project(frame(replay, live));
  const skipped = snapshot(3, { elapsed: .1, replayActive: false, ballX: 777 }); const projection = owner.project(frame(skipped, replay));
  assert.equal(projection.replay.active, false); assert.equal(projection.replaySnapshot, null); assert.equal(projection.renderSnapshot, skipped); assert.equal(projection.renderSnapshot.ball.x, 777);
});

test("fresh kickoff restoration clears prior replay history", () => {
  const owner = adapter(); owner.attach(); const live1 = snapshot(10, { elapsed: 8 }); const live2 = snapshot(11, { elapsed: 8.2 }); owner.project(frame(live1)); owner.project(frame(live2, live1)); assert.ok(owner.diagnostics().replay.historyFrames > 0);
  const menu = snapshot(12, { elapsed: 8.2, state: "menu" }); owner.project(frame(menu, live2)); const kickoff = snapshot(13, { elapsed: 0, state: "playing", ballX: 600 }); const projection = owner.project(frame(kickoff, menu));
  assert.equal(projection.replay.active, false); assert.equal(projection.renderSnapshot, kickoff); assert.equal(owner.diagnostics().replay.historyFrames, 1); assert.equal(owner.diagnostics().replay.incidentFrames, 0);
});

test("reports a missing replay frame without inventing gameplay state", () => {
  const owner = adapter(); owner.attach(); const active = snapshot(20, { replayActive: true, replayElapsed: .4 }); const projection = owner.project(frame(active, active));
  assert.equal(projection.replay.active, true); assert.equal(projection.replay.missingFrame, true); assert.equal(projection.replaySnapshot, null); assert.equal(projection.renderSnapshot, active);
});

test("reset and teardown are explicit and terminal", () => {
  const owner = adapter(); assert.equal(owner.attach(), true); owner.project(frame(snapshot(1))); assert.equal(owner.reset(), true); assert.equal(owner.diagnostics().renderCount, 0); assert.equal(owner.diagnostics().replay.incidentFrames, 0); assert.equal(owner.teardown(), true); assert.equal(owner.diagnostics().status, "disposed"); assert.equal(owner.project(frame(snapshot(2))), null); assert.equal(owner.attach(), false);
});
