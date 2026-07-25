import assert from "node:assert/strict";
import test from "node:test";

import { cameraHudConfig } from "../../src/game/config/cameraHudConfig.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createSnapshotCameraReplayAdapter } from "../../src/game/presentation/SnapshotCameraReplayAdapter.js";

function snapshot(tick, {
  elapsed = tick / 10,
  replayActive = false,
  replayElapsed = 0,
  replayDuration = 2,
  goalSequence = null,
  ballX = 300,
  score = [0, 0],
} = {}) {
  return createMatchSnapshot({
    tick,
    match: {
      state: "playing",
      elapsed,
      time: 150 - elapsed,
      score,
      selectedPlayerId: "home-0",
      settings: { pitchStyle: "classic", ballStyle: "classic", weather: "clear" },
      replay: { active: replayActive, elapsed: replayElapsed, duration: replayDuration },
      goalSequence,
    },
    players: [
      { id: "home-0", team: 0, index: 0, role: "FW", x: 300, y: 350, vx: 0, vy: 0 },
      { id: "away-0", team: 1, index: 0, role: "GK", x: 1000, y: 350, vx: 0, vy: 0 },
    ],
    ball: { id: "match-ball", x: ballX, y: 350, vx: 120, vy: 0, radius: 9, ownerId: null, trail: [], possession: { state: "loose" } },
  });
}
const goal = (phase) => ({ team: 0, scorerId: "home-0", phase, elapsed: 0, duration: 4 });
const frame = (current, previous = current) => Object.freeze({ snapshot: current, previousSnapshot: previous, alpha: 1, nowMilliseconds: current.tick * 100, cameraMode: "broadcast" });

function owner() {
  const adapter = createSnapshotCameraReplayAdapter({
    worldWidth: 1200,
    worldHeight: 700,
    viewportWidth: 1200,
    viewportHeight: 700,
    cameraConfig: cameraHudConfig.camera,
    sampleRate: 10,
    maxFrames: 12,
    preShotFrames: 2,
  });
  adapter.attach();
  return adapter;
}

test("replay incident side remains stable while selected frames cross midfield", () => {
  const adapter = owner();

  const preShot = snapshot(10, { elapsed: .3, ballX: 220 });
  const shot = snapshot(11, { elapsed: .4, ballX: 420 });
  const goalFrame = snapshot(12, { elapsed: .4, ballX: 1135, score: [1, 0], goalSequence: goal("flash") });
  const aftermath = snapshot(13, { elapsed: .4, ballX: 1145, score: [1, 0], goalSequence: goal("highlight") });
  const replayStart = snapshot(14, { elapsed: .4, score: [1, 0], replayActive: true, replayElapsed: 0, goalSequence: goal("replay") });

  adapter.project(frame(preShot));
  adapter.project(frame(shot, preShot));
  adapter.project(frame(goalFrame, shot));
  adapter.project(frame(aftermath, goalFrame));
  const first = adapter.project(frame(replayStart, aftermath));

  const elapsedSamples = [.1, .6, 1.1, 1.99];
  const positions = [];
  const sides = [];
  const cinematicAvailability = [];
  let previous = replayStart;
  for (const [index, replayElapsed] of elapsedSamples.entries()) {
    const current = snapshot(15 + index, {
      elapsed: .4,
      score: [1, 0],
      replayActive: true,
      replayElapsed,
      goalSequence: goal("replay"),
    });
    const projection = adapter.project(frame(current, previous));
    positions.push(projection.replaySnapshot.ball.x);
    sides.push(projection.replay.scoringRight);
    cinematicAvailability.push(projection.replay.cinematicAvailable);
    previous = current;
  }

  assert.equal(first.replay.scoringRight, true);
  assert.equal(first.replay.cinematicAvailable, true);
  assert.equal(adapter.replay.scoringRight, true);
  assert.equal(adapter.replay.cinematicAvailable, true);
  assert.deepEqual(positions, [220, 420, 1135, 1145]);
  assert.deepEqual(sides, [true, true, true, true]);
  assert.deepEqual(cinematicAvailability, [true, true, true, true]);
  assert.equal(adapter.diagnostics().replay.playbackScoringRight, true);

  const live = snapshot(30, { elapsed: .5, score: [1, 0], replayActive: false, ballX: 600 });
  const restored = adapter.project(frame(live, previous));
  assert.equal(restored.replay.scoringRight, null);
  assert.equal(restored.replay.cinematicAvailable, false);
  assert.equal(adapter.replay.scoringRight, null);
  assert.equal(adapter.replay.cinematicAvailable, false);
  assert.equal(adapter.diagnostics().replay.playbackScoringRight, null);
});

test("late restore during active replay uses a frozen current-frame fallback and recovers on exit", () => {
  const adapter = owner();
  const preShot = snapshot(1, { elapsed: .1, ballX: 220 });
  const terminal = snapshot(2, { elapsed: .1, ballX: 1145, score: [1, 0], goalSequence: goal("highlight") });
  const replay = snapshot(3, { elapsed: .1, score: [1, 0], replayActive: true, replayElapsed: .2, goalSequence: goal("replay") });
  adapter.project(frame(preShot));
  adapter.project(frame(terminal, preShot));
  const buffered = adapter.project(frame(replay, terminal));
  assert.equal(buffered.replay.cinematicAvailable, true);
  assert.equal(buffered.replay.scoringRight, true);

  assert.equal(adapter.reset(), true);
  const restoredReplay = snapshot(4, { elapsed: .1, score: [1, 0], replayActive: true, replayElapsed: .6, goalSequence: goal("replay") });
  const fallback = adapter.project(frame(restoredReplay, replay));
  assert.equal(fallback.replay.active, true);
  assert.equal(fallback.replay.missingFrame, true);
  assert.equal(fallback.replay.cinematicAvailable, false);
  assert.equal(fallback.replay.scoringRight, null);
  assert.equal(fallback.replaySnapshot, null);
  assert.equal(fallback.renderSnapshot, restoredReplay);
  assert.equal(adapter.replay.currentSnapshot(), restoredReplay);
  assert.equal(Object.isFrozen(adapter.replay.currentSnapshot()), true);
  assert.equal(adapter.diagnostics().replay.playbackFrames, 0);

  const live = snapshot(5, { elapsed: .2, score: [1, 0], replayActive: false, ballX: 600 });
  const recovered = adapter.project(frame(live, restoredReplay));
  assert.equal(recovered.replay.active, false);
  assert.equal(recovered.replay.missingFrame, false);
  assert.equal(recovered.replay.cinematicAvailable, false);
  assert.equal(recovered.replay.scoringRight, null);
  assert.equal(recovered.renderSnapshot, live);
});
