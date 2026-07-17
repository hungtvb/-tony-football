import assert from "node:assert/strict";
import test from "node:test";

import { BrowserRuntimeMode } from "../../src/game/application/BrowserRuntimeComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { CompatibilitySnapshotAdapter } from "../../src/game/presentation/CompatibilitySnapshotAdapter.js";

const STEP = 1 / 60;

function snapshot({
  tick,
  state = "playing",
  elapsed = tick / 60,
  replayActive = false,
  replayElapsed = 0,
  goalSequence = replayActive ? { team: 0, nextTeam: 1, timer: 3.5, duration: 3.65 } : null,
}) {
  return createMatchSnapshot({
    tick,
    match: {
      state,
      difficulty: "pro",
      time: 150 - elapsed,
      matchSeconds: 150,
      elapsed,
      score: replayActive ? [1, 0] : [0, 0],
      stats: { possession: [elapsed, 0], shots: [0, 0], passes: 0, completed: 0 },
      selectedPlayerId: "home-0",
      settings: { pitchStyle: "classic", ballStyle: "classic", weather: "clear" },
      controls: { lastMode: "attack" },
      replay: { active: replayActive, elapsed: replayElapsed, duration: 3.05 },
      goalSequence,
      kickoffTimer: 0,
    },
    players: [
      { id: "home-0", team: 0, index: 0, x: 200, y: 350 },
      { id: "away-0", team: 1, index: 0, x: 1000, y: 350 },
    ],
    ball: {
      id: "match-ball",
      x: 600,
      y: 350,
      vx: 0,
      vy: 0,
      height: 0,
      ownerId: null,
      lastTouchId: "home-0",
      trail: [],
      pendingPass: null,
      possession: { state: "released", ownerId: null },
    },
  });
}

function createSource(calls) {
  return {
    tick: 0,
    players: [{ team: 0, index: 0 }, { team: 1, index: 0 }],
    score: [0, 0],
    stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    ball: { trail: [], possession: {} },
    replay: {
      reset() { calls.push("reset"); },
      record(value, deltaSeconds) {
        calls.push(["record", value.tick, deltaSeconds]);
        return true;
      },
      start(value) { calls.push(["start", value.tick]); return true; },
      update(deltaSeconds) { calls.push(["update", deltaSeconds]); return false; },
      stop() { calls.push("stop"); },
    },
  };
}

test("live engine snapshots fill history, advance playback, and stop from engine replay clock", () => {
  const snapshots = [
    snapshot({ tick: 0, state: "menu", elapsed: 0 }),
    snapshot({ tick: 1, state: "playing", elapsed: 0 }),
    snapshot({ tick: 2, state: "playing", elapsed: STEP }),
    snapshot({ tick: 3, state: "playing", elapsed: STEP * 2 }),
    snapshot({ tick: 4, state: "playing", elapsed: STEP * 3, replayActive: true, replayElapsed: 0 }),
    snapshot({ tick: 5, state: "playing", elapsed: STEP * 3, replayActive: true, replayElapsed: STEP }),
    snapshot({ tick: 6, state: "playing", elapsed: STEP * 3, replayActive: false, replayElapsed: STEP * 2, goalSequence: null }),
  ];
  const runtimeComposition = {
    configure() {},
    advanceToSourceTick() {
      return snapshots.shift();
    },
    createRenderFrame() {
      throw new Error("not used");
    },
  };
  const calls = [];
  const source = createSource(calls);
  const adapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition,
  });

  for (let tick = 0; tick <= 6; tick += 1) {
    source.tick = tick;
    adapter.capture(source);
  }

  assert.deepEqual(calls, [
    "reset",
    ["record", 2, STEP],
    ["record", 3, STEP],
    ["start", 4],
    ["update", STEP],
    ["update", STEP],
    "stop",
  ]);
  assert.deepEqual(source.score, [0, 0]);
});

test("goal-sequence snapshots do not contaminate the next replay history", () => {
  const snapshots = [
    snapshot({ tick: 10, state: "playing", elapsed: 1 }),
    snapshot({
      tick: 11,
      state: "playing",
      elapsed: 1 + STEP,
      replayActive: false,
      goalSequence: { team: 0, nextTeam: 1, timer: 3.6, duration: 3.65 },
    }),
  ];
  const runtimeComposition = {
    configure() {},
    advanceToSourceTick() { return snapshots.shift(); },
    createRenderFrame() { throw new Error("not used"); },
  };
  const calls = [];
  const source = createSource(calls);
  const adapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition,
  });

  source.tick = 10;
  adapter.capture(source);
  source.tick = 11;
  adapter.capture(source);

  assert.deepEqual(calls, ["reset"]);
});
