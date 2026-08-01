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
  assert.equal(profile.field.lengthMetres, 50);
  assert.equal(profile.field.widthMetres, 32);
  assert.equal(profile.field.aspectRatio, 1.5625);
  assert.equal(profile.field.areaSquareMetres, 1600);
  assert.deepEqual(profile.field.runoffMetres, { behindGoal: 5, touchline: 1.5 });
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
  assert.equal(simulationUnitsToMetres(1000), 50);
  assert.equal(metresToSimulationUnits(5), 100);
  assert.equal(simulationUnitsToWorldUnits(100), 5);
});

test("default 6v6 field ratios stay inside the calibrated compact envelope", () => {
  const profile = DEFAULT_SIMULATION_SCALE_PROFILE;
  assert.ok(profile.field.aspectRatio >= 1.45 && profile.field.aspectRatio <= 1.65);
  assert.equal(profile.field.areaSquareMetres / 12, 1600 / 12);
  assert.equal(profile.field.markings.centreCircleRadiusMetres, 3);
  assert.equal(profile.field.markings.penaltyAreaDepthMetres, 6);
  assert.equal(profile.field.markings.penaltyAreaWidthMetres, 12);
  assert.equal(profile.field.markings.penaltyMarkDistanceMetres, 6);
  assert.equal(profile.field.markings.lineWidthMetres, 0.08);
  assert.ok(profile.goal.mouthWidthMetres / profile.field.widthMetres <= 0.16);
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
  input.field.bounds = { left: 100, right: 1100, top: 40, bottom: 640 };
  assert.throws(
    () => createSimulationScaleProfile(input),
    /field bounds must remain centred/,
  );
});

const invalidFieldGeometryCases = [
  [
    "a field without behind-goal runoff",
    (input) => { input.field.bounds = { left: 0, right: 1200, top: 30, bottom: 670 }; },
    /positive runoff/,
  ],
  [
    "a field whose length is not greater than its width",
    (input) => { input.field.bounds = { left: 280, right: 920, top: 30, bottom: 670 }; },
    /touchline length must be greater/,
  ],
  [
    "a centre circle that cannot fit",
    (input) => { input.field.markings.centreCircleRadiusMetres = 16; },
    /centre circle must fit/,
  ],
  [
    "penalty areas that overlap",
    (input) => { input.field.markings.penaltyAreaDepthMetres = 25; },
    /penalty areas must fit/,
  ],
  [
    "a penalty area wider than the pitch",
    (input) => { input.field.markings.penaltyAreaWidthMetres = 32; },
    /penalty areas must fit/,
  ],
  [
    "a goal area deeper than the penalty area",
    (input) => { input.field.markings.goalAreaDepthMetres = 7; },
    /goal area must fit/,
  ],
  [
    "a goal area wider than the penalty area",
    (input) => { input.field.markings.goalAreaWidthMetres = 13; },
    /goal area must fit/,
  ],
  [
    "a penalty mark outside the penalty area",
    (input) => { input.field.markings.penaltyMarkDistanceMetres = 7; },
    /penalty mark must remain inside/,
  ],
];

for (const [name, mutate, expected] of invalidFieldGeometryCases) {
  test(`simulation scale profile rejects ${name}`, () => {
    const input = structuredClone(DEFAULT_SIMULATION_SCALE_PROFILE);
    delete input.simulation.worldUnitsPerSimulationUnit;
    input.id = `invalid-${name.replaceAll(" ", "-")}`;
    mutate(input);
    assert.throws(() => createSimulationScaleProfile(input), expected);
  });
}
