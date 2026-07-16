import assert from "node:assert/strict";
import test from "node:test";

import { BrowserRuntimeMode } from "../../src/game/application/BrowserRuntimeComposition.js";
import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { CompatibilitySnapshotAdapter } from "../../src/game/presentation/CompatibilitySnapshotAdapter.js";

function snapshot({ tick, state = "playing", elapsed = tick / 60, replayActive = false }) {
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
      replay: { active: replayActive, elapsed: 0, duration: 3.05 },
      goalSequence: replayActive ? { team: 0, nextTeam: 1, timer: 3.5, duration: 3.65 } : null,
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

test("live replay state starts and stops the temporary browser replay controller", () => {
  const snapshots = [
    snapshot({ tick: 0, state: "menu", elapsed: 0 }),
    snapshot({ tick: 1, state: "playing", elapsed: 0 }),
    snapshot({ tick: 2, state: "playing", elapsed: STEP, replayActive: true }),
    snapshot({ tick: 3, state: "playing", elapsed: STEP * 2, replayActive: false }),
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
  const source = {
    tick: 0,
    players: [{ team: 0, index: 0 }, { team: 1, index: 0 }],
    score: [0, 0],
    stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    ball: { trail: [], possession: {} },
    replay: {
      reset() { calls.push("reset"); },
      start(value) { calls.push(["start", value.tick]); return true; },
      stop() { calls.push("stop"); },
    },
  };
  const adapter = new CompatibilitySnapshotAdapter({
    mode: BrowserRuntimeMode.ENGINE,
    runtimeComposition,
  });

  adapter.capture(source);
  source.tick = 1;
  adapter.capture(source);
  source.tick = 2;
  adapter.capture(source);
  source.tick = 3;
  adapter.capture(source);

  assert.deepEqual(calls, ["reset", ["start", 2], "stop"]);
  assert.deepEqual(source.score, [0, 0]);
});

const STEP = 1 / 60;
