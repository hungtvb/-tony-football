import assert from "node:assert/strict";
import test from "node:test";

import { ballControlConfig } from "../../src/game/config/ballControlConfig.js";
import { locomotionConfig } from "../../src/game/config/locomotionConfig.js";
import { advanceBallSimulation } from "../../src/game/engine/BallSimulationSystem.js";
import { GameCommandSource, GameCommandType } from "../../src/game/engine/GameCommands.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";
import { createMatchState } from "../../src/game/engine/MatchState.js";
import {
  advancePlayerMovement,
  createFieldBounds
} from "../../src/game/engine/PlayerMovementSystem.js";

const FIXED_DELTA = 1 / 60;

function startEngine(options = {}) {
  const engine = new MatchEngine({ kickoffDelay: 0, ...options });
  engine.enqueue(GameCommandType.START_MATCH, {}, { source: GameCommandSource.TEST });
  return engine;
}

test("controlled movement preserves the current fixed-step locomotion response", () => {
  const engine = startEngine();
  engine.enqueue(GameCommandType.MOVE, { x: 1, y: 0 });
  engine.step(FIXED_DELTA);

  const player = engine.snapshot.players.find(({ id }) => id === "home-4");
  const expectedVelocity = locomotionConfig.controlled.baseSpeed
    * (1 - Math.exp(-locomotionConfig.controlled.accelerationResponse * FIXED_DELTA));
  assert.ok(Math.abs(player.vx - expectedVelocity) < 1e-9);
  assert.ok(Math.abs(player.x - (690 + expectedVelocity * FIXED_DELTA)) < 1e-9);
  assert.equal(player.dirX, 1);
  assert.equal(player.dirY, 0);
});

test("sprint gains speed and drains stamina while shielding keeps precision pace", () => {
  function simulate({ sprinting = false, shielding = false }) {
    const engine = startEngine();
    engine.enqueue(GameCommandType.MOVE, { x: 1, y: 0 });
    engine.enqueue(GameCommandType.SET_SPRINT, { active: sprinting });
    engine.enqueue(GameCommandType.SET_SHIELD, { active: shielding });
    for (let tick = 0; tick < 60; tick += 1) engine.step(FIXED_DELTA);
    return engine.snapshot.players.find(({ id }) => id === "home-4");
  }

  const normal = simulate({});
  const sprint = simulate({ sprinting: true });
  const precision = simulate({ sprinting: true, shielding: true });
  assert.ok(sprint.x > normal.x);
  assert.ok(sprint.stamina < normal.stamina);
  assert.ok(precision.x < normal.x);
  assert.equal(precision.sprinting, false);
});

test("owned ball follows the dribble anchor and accumulates possession", () => {
  const engine = startEngine();
  engine.enqueue(GameCommandType.MOVE, { x: 1, y: 0 });
  engine.step(FIXED_DELTA);
  engine.setPossession("home-4", { reason: "test-control" });
  for (let tick = 0; tick < 30; tick += 1) engine.step(FIXED_DELTA);

  const snapshot = engine.snapshot;
  const owner = snapshot.players.find(({ id }) => id === "home-4");
  assert.equal(snapshot.ball.ownerId, owner.id);
  assert.equal(snapshot.ball.possession.state, "controlled");
  assert.ok(snapshot.ball.x > owner.x);
  assert.ok(snapshot.match.stats.possession[0] > 0.49);
  assert.equal(snapshot.ball.height, 0);
});

test("loose ball keeps current friction, bounce, and goal-line semantics", () => {
  const field = createFieldBounds();
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  state.ball.lock = 1;
  state.ball.x = field.right + 19;
  state.ball.y = 350;
  state.ball.vx = 120;
  state.ball.vy = 0;
  const result = advanceBallSimulation(state, FIXED_DELTA, { field });
  const expectedVelocity = 120 * Math.pow(0.22, FIXED_DELTA);

  assert.equal(result.goalTeam, 0);
  assert.ok(Math.abs(state.ball.vx - expectedVelocity) < 1e-9);
  assert.equal(state.ball.height, 0);
});

test("eligible loose ball resolves first touch into engine possession", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const receiver = state.players.find(({ id }) => id === "home-4");
  state.ball.x = receiver.x + ballControlConfig.capture.outfieldRadius - 2;
  state.ball.y = receiver.y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.lock = 0;
  advanceBallSimulation(state, FIXED_DELTA);

  assert.equal(state.ball.ownerId, receiver.id);
  assert.equal(state.ball.lastTouchId, receiver.id);
  assert.equal(state.ball.possession.state, "controlled");
  assert.equal(state.selectedPlayerId, receiver.id);
  assert.equal(receiver.anim, "receive");
});

test("player collisions and field bounds resolve in headless state", () => {
  const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
  const first = state.players[1];
  const second = state.players[2];
  first.x = 400;
  first.y = 350;
  second.x = 401;
  second.y = 350;
  const bounded = state.players[3];
  bounded.x = 0;
  bounded.y = 0;
  advancePlayerMovement(state, FIXED_DELTA);

  const distance = Math.hypot(first.x - second.x, first.y - second.y);
  const field = createFieldBounds();
  assert.ok(bounded.x >= field.left + bounded.radius + 5);
  assert.ok(bounded.y >= field.top + bounded.radius + 5);
  assert.ok(distance >= first.radius + second.radius + 3 - 1e-9);
});
