import assert from "node:assert/strict";
import test from "node:test";

import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";
import { createHudSnapshotProjection } from "../../src/game/presentation/HudSnapshotProjection.js";

function simulateIdleMatch(seconds = 90) {
  const engine = new MatchEngine({ kickoffDelay: 0, randomSeed: "ton-71-idle-activity" });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.APPLICATION });
  const kicks = [];
  for (let tick = 0; tick < seconds * 60; tick += 1) {
    engine.step(1 / 60);
    kicks.push(...engine.drainEvents().filter((event) => event.type === GameEventType.BALL_KICKED));
  }
  return { engine, kicks };
}

test("idle selected-owner assist prevents the default engine action pipeline from stalling", () => {
  const { engine, kicks } = simulateIdleMatch();
  const homeKicks = kicks.filter((event) => event.payload.playerId.startsWith("home-"));
  const passes = homeKicks.filter((event) => event.payload.type !== GameCommandType.SHOOT);
  const shots = kicks.filter((event) => event.payload.type === GameCommandType.SHOOT);

  assert.ok(passes.length > 0, "representative home AI play should produce a pass");
  assert.ok(shots.length > 0, "representative AI play should produce a shot");
  assert.ok(engine.snapshot.match.stats.passes > 0);
  assert.ok(engine.snapshot.match.stats.shots.some((count) => count > 0));
});

test("HUD statistics remain a faithful projection of authoritative activity", () => {
  const { engine } = simulateIdleMatch();
  const snapshot = engine.snapshot;
  const hud = createHudSnapshotProjection(snapshot);
  const expectedAccuracy = snapshot.match.stats.passes > 0
    ? Math.round(snapshot.match.stats.completed / snapshot.match.stats.passes * 100)
    : 0;

  assert.deepEqual(hud.shots, snapshot.match.stats.shots);
  assert.equal(hud.passAccuracy, expectedAccuracy);
  assert.ok(hud.homePossession >= 0 && hud.homePossession <= 100);
});
