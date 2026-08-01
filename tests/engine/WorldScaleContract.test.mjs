import assert from "node:assert/strict";
import test from "node:test";

import {
  createSimulationScaleProfile,
  DEFAULT_SIMULATION_SCALE_PROFILE,
} from "../../src/game/config/simulationScaleProfile.js";
import { advanceBallSimulation } from "../../src/game/engine/BallSimulationSystem.js";
import { GameCommandType } from "../../src/game/engine/GameCommands.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";
import { createMatchState } from "../../src/game/engine/MatchState.js";
import { createFieldBounds } from "../../src/game/engine/PlayerMovementSystem.js";
import { DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE } from "../../src/game/presentation/ThreeSceneEnvironmentProfile.js";

const FIXED_DELTA = 1 / 60;

test("engine and WebGL geometry derive field and goal dimensions from the same profile", () => {
  const scale = DEFAULT_SIMULATION_SCALE_PROFILE;
  const field = createFieldBounds();
  const webgl = DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE.geometry;

  assert.equal(field.left, webgl.field.left);
  assert.equal(field.right, webgl.field.right);
  assert.equal(field.top, webgl.field.top);
  assert.equal(field.bottom, webgl.field.bottom);
  assert.equal(field.goalTop, webgl.goal.top);
  assert.equal(field.goalBottom, webgl.goal.bottom);
  assert.equal(webgl.worldScale, scale.simulation.worldUnitsPerSimulationUnit);
  assert.equal(webgl.goal.mouthWidth, scale.goal.mouthWidthMetres);
  assert.equal(webgl.goal.height, field.goalCrossbarHeight);
  assert.equal(webgl.goal.depth, scale.goal.depthMetres);
});

test("goal scoring requires the whole ball to cross inside the posts and below the crossbar", () => {
  const field = createFieldBounds();
  const score = ({ x, y, height = 0 }) => {
    const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
    state.ball.ownerId = null;
    state.ball.lock = 1;
    state.ball.x = x;
    state.ball.y = y;
    state.ball.height = height;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.vz = 0;
    return advanceBallSimulation(state, FIXED_DELTA, { field }).goalTeam;
  };

  const radius = DEFAULT_SIMULATION_SCALE_PROFILE.ball.radiusSimulation;
  assert.equal(score({ x: field.right + radius + .01, y: 350 }), 0);
  assert.equal(score({ x: field.right + radius - .01, y: 350 }), null);
  assert.equal(score({ x: field.right + radius + .01, y: field.scoringGoalTop - .01 }), null);
  assert.equal(score({ x: field.right + radius + .01, y: 350, height: field.goalScoringMaxBallHeight + .01 }), null);
});

test("posts and crossbar bounce the ball at the rendered goal line", () => {
  const field = createFieldBounds();
  const bounce = ({ y, height = 0 }) => {
    const state = createMatchState({ runtimeState: "playing", kickoffDelay: 0 });
    state.ball.ownerId = null;
    state.ball.lock = 1;
    state.ball.x = field.right + 1;
    state.ball.y = y;
    state.ball.height = height;
    state.ball.vx = 120;
    state.ball.vy = 0;
    state.ball.vz = 2;
    const result = advanceBallSimulation(state, FIXED_DELTA, { field });
    return { result, ball: state.ball };
  };

  const post = bounce({ y: field.scoringGoalTop - .01 });
  assert.equal(post.result.goalTeam, null);
  assert.equal(post.ball.x, field.right - post.ball.radius);
  assert.ok(post.ball.vx < 0);

  const crossbar = bounce({ y: 350, height: field.goalScoringMaxBallHeight + .01 });
  assert.equal(crossbar.result.goalTeam, null);
  assert.equal(crossbar.ball.x, field.right - crossbar.ball.radius);
  assert.ok(crossbar.ball.vx < 0);
});

test("changing metric density preserves fixed-step timing and command response", () => {
  const input = structuredClone(DEFAULT_SIMULATION_SCALE_PROFILE);
  input.id = "mini-6v6-double-density";
  input.simulation.unitsPerMetre = 40;
  const denseProfile = createSimulationScaleProfile(input);
  const normal = new MatchEngine({ kickoffDelay: 0 });
  const dense = new MatchEngine({ kickoffDelay: 0, scaleProfile: denseProfile });

  for (const engine of [normal, dense]) {
    engine.enqueue(GameCommandType.START_MATCH);
    engine.enqueue(GameCommandType.MOVE, { x: 1, y: 0 });
    engine.step(FIXED_DELTA);
  }

  const normalPlayer = normal.snapshot.players.find((player) => player.id === "home-4");
  const densePlayer = dense.snapshot.players.find((player) => player.id === "home-4");
  assert.equal(normal.snapshot.match.time, dense.snapshot.match.time);
  assert.equal(normalPlayer.x, densePlayer.x);
  assert.equal(normalPlayer.vx, densePlayer.vx);
  assert.equal(normal.snapshot.match.controls.moveX, dense.snapshot.match.controls.moveX);
  assert.equal(normal.snapshot.match.controls.moveY, dense.snapshot.match.controls.moveY);
});
