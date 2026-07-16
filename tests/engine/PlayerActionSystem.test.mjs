import assert from "node:assert/strict";
import test from "node:test";

import { createSeededRandom } from "../../src/game/core/Random.js";
import { createMatchState, findPlayer } from "../../src/game/engine/MatchState.js";
import { executeTackle, triggerTeammateRun } from "../../src/game/engine/PlayerActionSystem.js";
import { controlPossession } from "../../src/game/gameplay/PossessionLifecycle.js";

function tackleState() {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const player = findPlayer(state, "home-4");
  const opponent = findPlayer(state, "away-4");
  player.x = 600;
  player.y = 350;
  player.dirX = 1;
  player.dirY = 0;
  opponent.x = 640;
  opponent.y = 350;
  state.ball.ownerId = opponent.id;
  state.ball.lastTouchId = opponent.id;
  state.ball.possession = controlPossession(state.ball.possession, opponent.id, "clean");
  return { state, player, opponent };
}

test("successful slide tackle preserves release impulse and locomotion boost", () => {
  const { state, player, opponent } = tackleState();
  const result = executeTackle(state, {
    random: { next: () => 0 }
  });

  assert.equal(result.won, true);
  assert.equal(result.opponentId, opponent.id);
  assert.equal(state.ball.ownerId, null);
  assert.equal(state.ball.lastTouchId, player.id);
  assert.equal(state.ball.vx, 250);
  assert.equal(state.ball.vy, 0);
  assert.equal(state.ball.possession.releaseReason, "tackle");
  assert.equal(player.cooldown, 1.05);
  assert.equal(player.vx, 105);
  assert.equal(player.anim, "tackle");
  assert.equal(player.animPower, 1);
});

test("failed tackle still commits the slide without stealing possession", () => {
  const { state, player, opponent } = tackleState();
  const result = executeTackle(state, {
    random: { next: () => 1 }
  });

  assert.equal(result.won, false);
  assert.equal(state.ball.ownerId, opponent.id);
  assert.equal(player.cooldown, 1.05);
  assert.equal(player.vx, 105);
});

test("standing tackle keeps the FO4 Space timing without slide impulse", () => {
  const { state, player } = tackleState();
  const result = executeTackle(state, {
    style: "standing",
    random: { next: () => 0 }
  });

  assert.equal(result.style, "standing");
  assert.equal(player.cooldown, 0.7);
  assert.equal(player.vx, 0);
  assert.equal(player.animTime, 0.38);
  assert.equal(player.animPower, 0);
});

test("tackle rejects cooldown and out-of-range attempts without mutation", () => {
  const cooldown = tackleState();
  cooldown.player.cooldown = 0.1;
  assert.equal(executeTackle(cooldown.state, { random: createSeededRandom(1) }), null);

  const distant = tackleState();
  distant.opponent.x = 800;
  assert.equal(executeTackle(distant.state, { random: createSeededRandom(1) }), null);
  assert.equal(distant.player.cooldown, 0);
});

test("loose-ball tackle still commits against the nearest opponent", () => {
  const { state, player, opponent } = tackleState();
  state.ball.ownerId = null;
  const result = executeTackle(state, { random: createSeededRandom(1) });

  assert.equal(result.opponentId, opponent.id);
  assert.equal(result.won, false);
  assert.equal(player.cooldown, 1.05);
});

test("teammate run selects the best directional runner and applies legacy boost", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const owner = findPlayer(state, "home-3");
  state.selectedPlayerId = owner.id;
  state.ball.ownerId = owner.id;
  state.ball.possession = controlPossession(state.ball.possession, owner.id, "clean");
  state.controls.moveX = 1;
  state.controls.moveY = 0;
  const result = triggerTeammateRun(state);
  const runner = findPlayer(state, result.runnerId);

  assert.equal(result.ownerId, owner.id);
  assert.ok(runner.vx > 0);
  assert.equal(runner.vy, 0);
  assert.equal(runner.controlBoost, 0.75);
});

test("teammate run requires the selected player to own the ball", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  assert.equal(triggerTeammateRun(state), null);
});
