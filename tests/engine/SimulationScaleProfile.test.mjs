import assert from "node:assert/strict";
import test from "node:test";

import {
  createSimulationScaleProfile,
  DEFAULT_SIMULATION_SCALE_PROFILE,
  metresToSimulationUnits,
  representativeRigScale,
  simulationUnitsToMetres,
  simulationUnitsToWorldUnits,
} from "../../src/game/config/simulationScaleProfile.js";

test("default simulation scale profile is a deeply frozen metric mini-football contract", () => {
  const profile = DEFAULT_SIMULATION_SCALE_PROFILE;
  assert.equal(profile.id, "mini-6v6-metric-v1");
  assert.equal(profile.simulation.unitsPerMetre, 20);
  assert.equal(profile.simulation.worldUnitsPerSimulationUnit, 0.05);
  assert.equal(profile.field.lengthMetres, 55.2);
  assert.equal(profile.field.widthMetres, 30.8);
  assert.equal(profile.goal.mouthWidthSimulation, 100);
  assert.equal(profile.goal.mouthTop, 300);
  assert.equal(profile.goal.mouthBottom, 400);
  assert.equal(profile.goal.scoringMouthTop, 302.2);
  assert.equal(profile.goal.scoringMouthBottom, 397.8);
  assert.equal(profile.goal.scoringMaxBallHeightMetres, 1.78);
  assert.equal(profile.player.representativeHeightWorldUnits, 1.8);
  assert.equal(profile.player.collisionRadiusSimulation, 6.4);
  assert.equal(profile.ball.radiusSimulation, 2.2);
  assert.equal(profile.ball.radiusWorldUnits, 0.11);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.field.markings), true);
  assert.equal(Object.isFrozen(profile.goal), true);
});

test("simulation scale conversions share one units-per-metre contract", () => {
  assert.equal(simulationUnitsToMetres(1104), 55.2);
  assert.equal(metresToSimulationUnits(5), 100);
  assert.equal(simulationUnitsToWorldUnits(100), 5);
});

test("simulation scale profile derives ratios from a custom units-per-metre setting", () => {
  const input = structuredClone(DEFAULT_SIMULATION_SCALE_PROFILE);
  delete input.simulation.worldUnitsPerSimulationUnit;
  input.id = "double-density";
  input.simulation.unitsPerMetre = 40;
  const profile = createSimulationScaleProfile(input);
  assert.equal(profile.simulation.worldUnitsPerSimulationUnit, 0.025);
  assert.equal(profile.goal.mouthWidthSimulation, 200);
  assert.equal(profile.ball.radiusSimulation, 4.4);
  assert.equal(profile.player.representativeHeightWorldUnits, 1.8);
});

test("player, ball, and goal ratios are measurable from one profile", () => {
  const profile = DEFAULT_SIMULATION_SCALE_PROFILE;
  assert.equal(profile.goal.mouthWidthMetres / profile.player.representativeHeightMetres, 5 / 1.8);
  assert.equal(profile.player.representativeHeightMetres / profile.ball.diameterMetres, 1.8 / .22);
  assert.ok(Math.abs(representativeRigScale(1.81960792) - .989224096) < 1e-6);
});

test("simulation scale profile rejects geometry that cannot fit", () => {
  const input = structuredClone(DEFAULT_SIMULATION_SCALE_PROFILE);
  delete input.simulation.worldUnitsPerSimulationUnit;
  input.goal.mouthWidthMetres = 40;
  assert.throws(() => createSimulationScaleProfile(input), /goal mouth must be narrower/);
});

test("simulation scale profile requires a non-empty string id", () => {
  const input = structuredClone(DEFAULT_SIMULATION_SCALE_PROFILE);
  delete input.simulation.worldUnitsPerSimulationUnit;

  for (const id of [undefined, null, "", "   ", 87]) {
    input.id = id;
    assert.throws(
      () => createSimulationScaleProfile(input),
      /non-empty string id/,
    );
  }
});

test("simulation scale profile rejects off-centre field bounds", () => {
  const input = structuredClone(DEFAULT_SIMULATION_SCALE_PROFILE);
  delete input.simulation.worldUnitsPerSimulationUnit;
  input.id = "off-centre-field";
  input.field.bounds = { left: 48, right: 1152, top: 50, bottom: 550 };
  assert.throws(
    () => createSimulationScaleProfile(input),
    /field bounds must remain centred/,
  );
});
