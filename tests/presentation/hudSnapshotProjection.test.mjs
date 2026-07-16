import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import {
  createHudSnapshotProjection,
  formatMatchClock
} from "../../src/game/presentation/HudSnapshotProjection.js";

test("HUD projection derives clock score selected player and match statistics from a snapshot", () => {
  const snapshot = createMatchSnapshot({
    tick: 90,
    match: {
      state: "playing",
      time: 75,
      matchSeconds: 150,
      elapsed: 75,
      score: [2, 1],
      selectedPlayerId: "home-4",
      stats: { possession: [30, 20], shots: [8, 3], passes: 25, completed: 20 }
    },
    players: [
      { id: "home-4", team: 0, name: "TONY", number: 10, rating: 92, stamina: 63 },
      { id: "away-4", team: 1, name: "BLAZE", number: 9, rating: 92, stamina: 70 }
    ],
    ball: { id: "match-ball", ownerId: "home-4", x: 600, y: 350 }
  });

  const hud = createHudSnapshotProjection(snapshot);

  assert.equal(hud.clock, "45:00");
  assert.deepEqual(hud.score, [2, 1]);
  assert.equal(hud.selectedPlayer.id, "home-4");
  assert.equal(hud.homePossession, 60);
  assert.deepEqual(hud.shots, [8, 3]);
  assert.equal(hud.passAccuracy, 80);
  assert.ok(Object.isFrozen(hud));
});

test("HUD projection clamps derived values and formats full-time safely", () => {
  assert.equal(formatMatchClock(0, 150), "00:00");
  assert.equal(formatMatchClock(150, 150), "90:00");

  const snapshot = createMatchSnapshot({
    tick: 1,
    match: {
      state: "ended",
      time: 0,
      matchSeconds: 150,
      score: [0, 0],
      selectedPlayerId: null,
      stats: { possession: [0, 0], shots: [0, 0], passes: 2, completed: 9 }
    },
    players: [],
    ball: { id: "match-ball", ownerId: null, x: 600, y: 350 }
  });
  const hud = createHudSnapshotProjection(snapshot);

  assert.equal(hud.clock, "90:00");
  assert.equal(hud.homePossession, 50);
  assert.equal(hud.passAccuracy, 100);
  assert.equal(hud.selectedPlayer, null);
});
