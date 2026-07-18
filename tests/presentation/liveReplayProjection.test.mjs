import assert from "node:assert/strict";
import test from "node:test";

import { BrowserRuntimeMode } from "../../src/game/application/BrowserRuntimeComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { CompatibilitySnapshotAdapter } from "../../src/game/presentation/CompatibilitySnapshotAdapter.js";
import { createSnapshotReplayController } from "../../src/game/presentation/SnapshotReplayController.js";

function createLiveSnapshot({ tick, elapsed, replayActive = false, replayElapsed = 0 }) {
  return createMatchSnapshot({
    tick,
    match: {
      state: "playing",
      difficulty: "pro",
      matchSeconds: 150,
      time: Math.max(0, 150 - elapsed),
      elapsed,
      score: [0, 0],
      stats: { possession: [elapsed, 0], shots: [0, 0], passes: 0, completed: 0 },
      selectedPlayerId: "home-4",
      settings: { pitchStyle: "classic", ballStyle: "volt", weather: "clear" },
      replay: { active: replayActive, elapsed: replayElapsed, duration: 3.05 },
      goalSequence: replayActive ? { phase: "replay" } : null,
    },
    players: [
      { id: "home-4", team: 0, index: 4, x: 600 + tick, y: 330, vx: 1, vy: 0 },
      { id: "away-4", team: 1, index: 4, x: 800, y: 370, vx: 0, vy: 0 },
    ],
    ball: {
      id: "match-ball",
      x: 610 + tick,
      y: 330,
      vx: 1,
      vy: 0,
      ownerId: "home-4",
      lastTouchId: "home-4",
      trail: [],
      pendingPass: null,
      possession: { state: "controlled", ownerId: "home-4" },
    },
  });
}

function createSource(replay) {
  const home = { team: 0, index: 4 };
  const away = { team: 1, index: 4 };
  return {
    tick: 0,
    state: "playing",
    matchSeconds: 150,
    time: 150,
    difficulty: "pro",
    score: [0, 0],
    stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    settings: { pitchStyle: "classic", ballStyle: "volt", weather: "clear" },
    replay,
    selectedPlayer: home,
    players: [home, away],
    ball: { x: 610, y: 330, vx: 0, vy: 0, owner: home, lastTouch: home, trail: [], pendingPass: null, possession: {} },
  };
}

function createRuntime(snapshots) {
  let index = 0;
  return {
    configure() {},
    advanceToSourceTick(tick) {
      const snapshot = snapshots[index++];
      assert.equal(snapshot.tick, tick);
      return snapshot;
    },
    createRenderFrame() { return null; },
  };
}

test("live replay cache follows authoritative elapsed without early visual completion", () => {
  const replay = createSnapshotReplayController({ minimumPlaybackFrames: 1, duration: 3.05 });
  const snapshots = [
    createLiveSnapshot({ tick: 0, elapsed: 0 }),
    createLiveSnapshot({ tick: 1, elapsed: 1 / 15 }),
    createLiveSnapshot({ tick: 2, elapsed: 1 / 15, replayActive: true, replayElapsed: 0 }),
    createLiveSnapshot({ tick: 3, elapsed: 1 / 15, replayActive: true, replayElapsed: 0.5 }),
    createLiveSnapshot({ tick: 4, elapsed: 1 / 15, replayActive: true, replayElapsed: 1 }),
    createLiveSnapshot({ tick: 5, elapsed: 1 / 15, replayActive: true, replayElapsed: 3.05 }),
    createLiveSnapshot({ tick: 6, elapsed: 1 / 15, replayActive: false, replayElapsed: 3.05 }),
  ];
  const source = createSource(replay);
  const adapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition: createRuntime(snapshots),
  });

  for (const snapshot of snapshots.slice(0, 3)) {
    source.tick = snapshot.tick;
    adapter.capture(source);
  }
  assert.equal(replay.active, true);
  assert.equal(replay.elapsed, 0);

  source.tick = 3;
  adapter.capture(source);
  assert.equal(replay.elapsed, 0.5);

  source.tick = 4;
  adapter.capture(source);
  assert.equal(replay.elapsed, 1);

  source.tick = 5;
  adapter.capture(source);
  assert.equal(replay.elapsed, 3.05);
  assert.equal(replay.active, true);
  assert.ok(replay.currentSnapshot());

  source.tick = 6;
  adapter.capture(source);
  assert.equal(replay.active, false);
  assert.equal(replay.currentSnapshot(), null);
});

test("live replay projection advances once per changed engine elapsed and stops once", () => {
  const calls = { start: 0, sync: [], stop: 0 };
  const replay = {
    reset() {},
    record() { return false; },
    start() { calls.start += 1; return true; },
    syncElapsed(value) { calls.sync.push(value); return true; },
    stop() { calls.stop += 1; },
  };
  const snapshots = [
    createLiveSnapshot({ tick: 0, elapsed: 0 }),
    createLiveSnapshot({ tick: 1, elapsed: 0, replayActive: true, replayElapsed: 0 }),
    createLiveSnapshot({ tick: 2, elapsed: 0, replayActive: true, replayElapsed: 0.5 }),
    createLiveSnapshot({ tick: 3, elapsed: 0, replayActive: true, replayElapsed: 0.5 }),
    createLiveSnapshot({ tick: 4, elapsed: 0, replayActive: true, replayElapsed: 1 }),
    createLiveSnapshot({ tick: 5, elapsed: 0, replayActive: false, replayElapsed: 1 }),
    createLiveSnapshot({ tick: 6, elapsed: 0, replayActive: false, replayElapsed: 1 }),
  ];
  const source = createSource(replay);
  const adapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition: createRuntime(snapshots),
  });

  for (const snapshot of snapshots) {
    source.tick = snapshot.tick;
    adapter.capture(source);
  }

  assert.equal(calls.start, 1);
  assert.deepEqual(calls.sync, [0.5, 1]);
  assert.equal(calls.stop, 1);
});
