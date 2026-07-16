import assert from "node:assert/strict";
import test from "node:test";

import {
  CompatibilitySnapshotAdapter,
  compatibilityPlayerId,
  createCompatibilitySnapshot
} from "../../src/game/presentation/CompatibilitySnapshotAdapter.js";

class LegacyPlayer {
  constructor(team, index, overrides = {}) {
    Object.assign(this, {
      team,
      index,
      role: index === 0 ? "GK" : "FW",
      name: team === 0 ? "TONY" : "BLAZE",
      number: index + 1,
      rating: 90,
      x: team === 0 ? 200 : 1000,
      y: 350,
      vx: 0,
      vy: 0,
      dirX: team === 0 ? 1 : -1,
      dirY: 0,
      stamina: 100,
      anim: "idle",
      animTime: 0,
      animDuration: 1,
      animPower: 0,
      stepPhase: index,
      sprinting: false,
      ...overrides
    });
  }
}

function createSource(tick = 4) {
  const home = new LegacyPlayer(0, 4, { x: 690, y: 205 });
  const away = new LegacyPlayer(1, 4, { x: 520, y: 495 });
  return {
    tick,
    state: "playing",
    matchSeconds: 150,
    time: 120,
    difficulty: "pro",
    score: [1, 0],
    stats: { possession: [18, 12], shots: [4, 2], passes: 10, completed: 8 },
    settings: { pitchStyle: "classic", ballStyle: "volt", weather: "clear" },
    replay: { active: false, elapsed: 0, duration: 3.05 },
    selectedPlayer: home,
    players: [home, away],
    ball: {
      x: 700,
      y: 210,
      vx: 20,
      vy: 5,
      height: 0,
      radius: 9,
      owner: home,
      lastTouch: home,
      trail: [{ x: 690, y: 208, height: 0 }],
      pendingPass: null,
      possession: {
        state: "controlled",
        ownerId: "0:4",
        receiverId: null,
        lastControllerId: "0:4",
        releaseReason: null,
        touchOutcome: "clean"
      }
    }
  };
}

test("compatibility snapshot converts legacy classes into immutable engine-shaped facts", () => {
  const source = createSource();
  const snapshot = createCompatibilitySnapshot(source);

  source.players[0].x = 999;
  source.score[0] = 8;
  source.ball.trail[0].x = 999;

  assert.equal(compatibilityPlayerId(source.players[0]), "home-4");
  assert.ok(snapshot.players.some((player) => player.id === compatibilityPlayerId(source.players[0])));
  assert.equal(snapshot.match.selectedPlayerId, "home-4");
  assert.deepEqual(snapshot.match.score, [1, 0]);
  assert.equal(snapshot.players[0].x, 690);
  assert.equal(snapshot.ball.ownerId, "home-4");
  assert.equal(snapshot.ball.possession.ownerId, "home-4");
  assert.equal(snapshot.ball.trail[0].x, 690);
  assert.ok(Object.isFrozen(snapshot.players[0]));
  assert.ok(Object.isFrozen(snapshot.ball.trail));
});

test("compatibility adapter retains previous/current fixed-tick snapshots for rendering", () => {
  const adapter = new CompatibilitySnapshotAdapter();
  const firstSource = createSource(8);
  const first = adapter.capture(firstSource);
  const initialFrame = adapter.createRenderFrame(0.25);

  assert.equal(initialFrame.previous, first);
  assert.equal(initialFrame.current, first);

  const nextSource = createSource(9);
  nextSource.players[0].x = 700;
  const next = adapter.capture(nextSource);
  const frame = adapter.createRenderFrame(0.5);

  assert.equal(frame.previous, first);
  assert.equal(frame.current, next);
  assert.equal(frame.current.players[0].x, 700);
  assert.throws(() => adapter.capture(createSource(7)), /cannot move backwards/);
});
