import assert from "node:assert/strict";
import test from "node:test";

import { advanceAIDecisions } from "../../src/game/engine/AIDecisionSystem.js";
import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { executeKickAction } from "../../src/game/engine/KickActionSystem.js";
import { createMatchState, findPlayer } from "../../src/game/engine/MatchState.js";
import { controlPossession } from "../../src/game/gameplay/PossessionLifecycle.js";

function sequenceRandom(values) {
  let index = 0;
  return {
    next() {
      const value = values[Math.min(index, values.length - 1)] ?? 0.5;
      index += 1;
      return value;
    }
  };
}

function giveBall(state, player) {
  state.ball.ownerId = player.id;
  state.ball.lastTouchId = player.id;
  state.ball.x = player.x;
  state.ball.y = player.y;
  state.ball.possession = controlPossession(state.ball.possession, player.id, "clean");
}

test("off-ball AI assigns deterministic chase and shape velocities", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const chaser = findPlayer(state, "away-3");
  const defender = findPlayer(state, "away-1");
  const commands = advanceAIDecisions(state, 1 / 60, {
    random: sequenceRandom([0.5]),
    tick: 10
  });

  assert.equal(commands.length, 0);
  assert.ok(chaser.vx < 0);
  assert.ok(Math.abs(chaser.vy) < 1e-9);
  assert.ok(defender.vx > 0);
});

test("AI owner near goal creates a seeded shoot command", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const owner = findPlayer(state, "away-4");
  owner.x = 250;
  owner.y = 350;
  giveBall(state, owner);
  const commands = advanceAIDecisions(state, 1 / 60, {
    random: sequenceRandom([0, 0.5]),
    tick: 22
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].type, GameCommandType.SHOOT);
  assert.equal(commands[0].source, GameCommandSource.AI);
  assert.equal(commands[0].payload.playerId, owner.id);
  assert.equal(commands[0].payload.power, 0.77);
  assert.equal(commands[0].targetTick, 22);
});

test("selected owner remains human-controlled until idle-owner assist is explicitly enabled", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const owner = findPlayer(state, state.selectedPlayerId);
  owner.x = 900;
  owner.y = 350;
  giveBall(state, owner);

  const humanOwned = advanceAIDecisions(state, 1 / 60, {
    random: sequenceRandom([0, 0.5]),
    tick: 40
  });
  assert.equal(humanOwned.length, 0);

  const assisted = advanceAIDecisions(state, 1 / 60, {
    random: sequenceRandom([0, 0.5]),
    tick: 41,
    allowSelectedOwnerAction: true
  });
  assert.equal(assisted.length, 1);
  assert.equal(assisted[0].type, GameCommandType.SHOOT);
  assert.equal(assisted[0].payload.playerId, owner.id);
});

test("pressured AI owner chooses a pass through the command boundary", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const owner = findPlayer(state, "away-3");
  const pressure = findPlayer(state, "home-1");
  owner.x = 700;
  owner.y = 350;
  pressure.x = 720;
  pressure.y = 350;
  giveBall(state, owner);
  const commands = advanceAIDecisions(state, 1 / 60, {
    random: sequenceRandom([0, 0]),
    tick: 30
  });

  assert.equal(commands.length, 1);
  assert.ok([
    GameCommandType.SHORT_PASS,
    GameCommandType.THROUGH_BALL
  ].includes(commands[0].type));
  assert.equal(commands[0].payload.playerId, owner.id);
});

test("goalkeeper projects incoming shots and publishes dive animation facts", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const goalkeeper = findPlayer(state, "home-0");
  state.ball.ownerId = null;
  state.ball.x = 300;
  state.ball.y = 500;
  state.ball.vx = -500;
  state.ball.vy = -100;
  state.ball.height = 0;
  advanceAIDecisions(state, 1 / 60, {
    random: sequenceRandom([0.5])
  });

  assert.equal(goalkeeper.anim, "dive");
  assert.equal(goalkeeper.animDuration, 0.5);
  assert.equal(goalkeeper.diveCooldown, 1.05);
  assert.notEqual(goalkeeper.animPower, 0);
});

test("defensive goalkeeper-rush control overrides normal positioning", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const goalkeeper = findPlayer(state, "home-0");
  state.controls.lastMode = "defense";
  state.controls.goalkeeperRush = true;
  state.ball.x = 600;
  state.ball.y = 350;
  advanceAIDecisions(state, 1 / 60, {
    random: sequenceRandom([0.5])
  });

  assert.ok(goalkeeper.vx > 0);
  assert.ok(Math.abs(goalkeeper.vy) < 1e-9);
});

test("goalkeeper clearance crosses the command boundary at legacy speed", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const goalkeeper = findPlayer(state, "home-0");
  giveBall(state, goalkeeper);
  const random = sequenceRandom([0.5]);
  const [clearance] = advanceAIDecisions(state, 1 / 60, {
    random,
    tick: 40
  });
  const result = executeKickAction(state, clearance, { random });

  assert.equal(clearance.type, GameCommandType.SHORT_PASS);
  assert.equal(clearance.payload.playerId, goalkeeper.id);
  assert.equal(result.targetId, "home-1");
  assert.ok(Math.abs(result.speed - 520) < 1e-9);
});
