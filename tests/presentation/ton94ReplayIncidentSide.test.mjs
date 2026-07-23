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

test("replay incident side remains stable while selected frames cross midfield", () => {
  const owner = createSnapshotCameraReplayAdapter({
    worldWidth: 1200,
    worldHeight: 700,
    viewportWidth: 1200,
    viewportHeight: 700,
    cameraConfig: cameraHudConfig.camera,
    sampleRate: 10,
    maxFrames: 12,
    preShotFrames: 2,
  });
  owner.attach();

  const preShot = snapshot(10, { elapsed: .3, ballX: 220 });
  const shot = snapshot(11, { elapsed: .4, ballX: 420 });
  const goalFrame = snapshot(12, { elapsed: .4, ballX: 1135, score: [1, 0], goalSequence: goal("flash") });
  const aftermath = snapshot(13, { elapsed: .4, ballX: 1145, score: [1, 0], goalSequence: goal("highlight") });
  const replayStart = snapshot(14, { elapsed: .4, score: [1, 0], replayActive: true, replayElapsed: 0, goalSequence: goal("replay") });

  owner.project(frame(preShot));
  owner.project(frame(shot, preShot));
  owner.project(frame(goalFrame, shot));
  owner.project(frame(aftermath, goalFrame));
  const first = owner.project(frame(replayStart, aftermath));

  const elapsedSamples = [.1, .6, 1.1, 1.99];
  const positions = [];
  const sides = [];
  let previous = replayStart;
  for (const [index, replayElapsed] of elapsedSamples.entries()) {
    const current = snapshot(15 + index, {
      elapsed: .4,
      score: [1, 0],
      replayActive: true,
      replayElapsed,
      goalSequence: goal("replay"),
    });
    const projection = owner.project(frame(current, previous));
    positions.push(projection.replaySnapshot.ball.x);
    sides.push(projection.replay.scoringRight);
    previous = current;
  }

  assert.equal(first.replay.scoringRight, true);
  assert.equal(owner.replay.scoringRight, true);
  assert.deepEqual(positions, [220, 420, 1135, 1145]);
  assert.deepEqual(sides, [true, true, true, true]);
  assert.equal(owner.diagnostics().replay.playbackScoringRight, true);

  const live = snapshot(30, { elapsed: .5, score: [1, 0], replayActive: false, ballX: 600 });
  const restored = owner.project(frame(live, previous));
  assert.equal(restored.replay.scoringRight, null);
  assert.equal(owner.replay.scoringRight, null);
  assert.equal(owner.diagnostics().replay.playbackScoringRight, null);
});
