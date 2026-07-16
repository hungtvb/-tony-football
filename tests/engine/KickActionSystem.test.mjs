import assert from "node:assert/strict";
import test from "node:test";

import { ballControlConfig } from "../../src/game/config/ballControlConfig.js";
import { createSeededRandom } from "../../src/game/core/Random.js";
import { createGameCommand, GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { executeKickAction } from "../../src/game/engine/KickActionSystem.js";
import { createMatchState, findPlayer } from "../../src/game/engine/MatchState.js";
import { controlPossession } from "../../src/game/gameplay/PossessionLifecycle.js";

function controlledState(playerId = "home-4") {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const player = findPlayer(state, playerId);
  state.ball.ownerId = player.id;
  state.ball.lastTouchId = player.id;
  state.ball.x = player.x + player.radius + 7;
  state.ball.y = player.y;
  state.ball.lock = 0;
  state.ball.possession = controlPossession(state.ball.possession, player.id, "clean");
  state.selectedPlayerId = player.id;
  return { state, player };
}

function command(type, payload) {
  return createGameCommand(type, payload, { source: GameCommandSource.TEST });
}

function execute(state, action) {
  return executeKickAction(state, action, { random: createSeededRandom("kick-test") });
}

test("short pass preserves target scoring, release speed, and pass bookkeeping", () => {
  const { state, player } = controlledState();
  const result = execute(state, command(GameCommandType.SHORT_PASS, {
    power: 0.35,
    direction: { x: 1, y: 0 }
  }));
  const target = findPlayer(state, result.targetId);
  const gap = Math.hypot(target.x - player.x, target.y - player.y);
  const powerScale = 0.82 + (1.16 - 0.82) * 0.35;
  const expectedSpeed = Math.min(760, Math.max(440, (430 + gap * 0.35) * powerScale));

  assert.ok(Math.abs(result.speed - expectedSpeed) < 1e-9);
  assert.equal(result.style, "short");
  assert.equal(state.ball.ownerId, null);
  assert.equal(state.ball.lastTouchId, player.id);
  assert.equal(state.ball.lock, ballControlConfig.release.passLock);
  assert.deepEqual(state.ball.pendingPass, { team: 0, timer: 1.8 });
  assert.equal(state.match.stats.passes, 1);
  assert.equal(player.anim, "pass");
});

test("one-two pass launches the passer with the current compatibility boost", () => {
  const { state, player } = controlledState();
  const result = execute(state, command(GameCommandType.SHORT_PASS, {
    power: 0.4,
    direction: { x: 1, y: 0.25 },
    modifiers: { oneTwo: true }
  }));

  assert.equal(result.style, "one-two");
  assert.ok(Math.abs(Math.hypot(player.vx, player.vy) - 225) < 1e-9);
  assert.equal(player.controlBoost, 0.7);
});

test("through and lofted passes retain their lead, height, lock, and timers", () => {
  const through = controlledState();
  const throughResult = execute(through.state, command(GameCommandType.THROUGH_BALL, {
    power: 0.45,
    direction: { x: 1, y: 0 }
  }));
  assert.equal(throughResult.style, "through");
  assert.equal(through.state.ball.vz, 0);
  assert.equal(through.state.ball.lock, ballControlConfig.release.passLock);
  assert.deepEqual(through.state.ball.pendingPass, { team: 0, timer: 2.1 });

  const loft = controlledState();
  const loftResult = execute(loft.state, command(GameCommandType.LOFTED_PASS, {
    power: 0.45,
    direction: { x: 1, y: -0.2 }
  }));
  assert.equal(loftResult.style, "loft");
  assert.ok(loft.state.ball.vz > 0);
  assert.equal(loft.state.ball.lock, ballControlConfig.release.loftPassLock);
  assert.deepEqual(loft.state.ball.pendingPass, { team: 0, timer: 2.2 });
});

test("power, finesse, and chip shots preserve style-specific velocity", () => {
  function shoot(modifiers) {
    const { state } = controlledState();
    const result = execute(state, command(GameCommandType.SHOOT, {
      power: 0.5,
      direction: { x: 1, y: -0.25 },
      ...(modifiers ? { modifiers } : {})
    }));
    return { state, result };
  }

  const power = shoot();
  assert.equal(power.result.style, "power");
  assert.equal(power.result.speed, 835);
  assert.equal(power.state.ball.vz, 1.8);

  const finesse = shoot({ finesse: true });
  assert.equal(finesse.result.style, "finesse");
  assert.equal(finesse.result.speed, 720);
  assert.equal(finesse.state.ball.vz, 2.6);
  assert.notEqual(finesse.state.ball.curve, 0);

  const chip = shoot({ chip: true });
  assert.equal(chip.result.style, "chip");
  assert.equal(chip.result.speed, 610);
  assert.equal(chip.state.ball.vz, 12.75);
  assert.equal(chip.state.ball.curve, 0);
  assert.equal(chip.state.match.stats.shots[0], 1);
});

test("kick commands cannot mutate the ball without matching possession", () => {
  const { state } = controlledState();
  const before = { ...state.ball };
  const result = execute(state, command(GameCommandType.SHOOT, {
    power: 0.5,
    playerId: "home-3",
    direction: { x: 1, y: 0 }
  }));

  assert.equal(result, null);
  assert.deepEqual(state.ball, before);
  assert.equal(state.match.stats.shots[0], 0);
});
