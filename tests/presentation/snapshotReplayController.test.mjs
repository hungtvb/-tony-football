import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createSnapshotReplayController } from "../../src/game/presentation/SnapshotReplayController.js";

function snapshot(tick, x = tick) {
  return createMatchSnapshot({
    tick,
    match: { state: "playing" },
    players: [{ id: "home-4", x, y: 200 }],
    ball: { id: "match-ball", ownerId: "home-4", x, y: 210 }
  });
}

test("snapshot replay samples immutable snapshots at 15 FPS and keeps the legacy buffer cap", () => {
  const replay = createSnapshotReplayController();
  for (let tick = 1; tick <= 70; tick += 1) replay.record(snapshot(tick), 1 / 15);

  assert.equal(replay.bufferedFrames, 66);
  assert.equal(replay.start(snapshot(71)), true);
  assert.equal(replay.playbackFrames, 67);
  assert.equal(replay.currentSnapshot().tick, 5);
  assert.ok(Object.isFrozen(replay.currentSnapshot()));
});

test("snapshot replay preserves playback duration and reports a single completion edge", () => {
  const replay = createSnapshotReplayController({ duration: 3.05, minimumPlaybackFrames: 2 });
  replay.record(snapshot(1), 1 / 15);
  replay.start(snapshot(2));

  assert.equal(replay.update(1.525), false);
  assert.equal(replay.currentSnapshot().tick, 2);
  assert.equal(replay.update(1.525), true);
  assert.equal(replay.active, false);
  assert.equal(replay.currentSnapshot(), null);
  assert.equal(replay.update(1), false);
});

test("snapshot replay reset clears recording and playback ownership", () => {
  const replay = createSnapshotReplayController({ minimumPlaybackFrames: 1 });
  replay.record(snapshot(1), 1 / 15);
  replay.start(snapshot(2));
  replay.reset();

  assert.equal(replay.active, false);
  assert.equal(replay.elapsed, 0);
  assert.equal(replay.bufferedFrames, 0);
  assert.equal(replay.playbackFrames, 0);
});
