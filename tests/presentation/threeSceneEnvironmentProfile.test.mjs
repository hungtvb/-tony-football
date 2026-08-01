import assert from "node:assert/strict";
import test from "node:test";

import {
  createThreeSceneEnvironmentProfile,
  DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE,
} from "../../src/game/presentation/ThreeSceneEnvironmentProfile.js";

function invalidProfile(mutator) {
  const profile = structuredClone(DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE);
  mutator(profile);
  return profile;
}

test("default Three scene environment profile is deeply frozen and preserves approved values", () => {
  const profile = DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE;
  assert.equal(profile.id, "tony-football-mini-6v6-v2");
  assert.equal(profile.geometry.worldScale, 0.05);
  assert.deepEqual(profile.geometry.field, { left: 100, right: 1100, top: 30, bottom: 670 });
  assert.equal(profile.geometry.goal.mouthWidth, 5);
  assert.equal(profile.geometry.goal.width, 5.1);
  assert.equal(profile.geometry.goal.height, 2);
  assert.equal(profile.geometry.markings.centreCircleRadiusSimulation, 60);
  assert.equal(profile.geometry.markings.penaltyAreaDepthSimulation, 120);
  assert.equal(profile.geometry.markings.penaltyAreaWidthSimulation, 240);
  assert.equal(profile.geometry.markings.goalAreaDepthSimulation, 80);
  assert.equal(profile.geometry.markings.goalAreaWidthSimulation, 200);
  assert.equal(profile.geometry.markings.penaltyMarkDistanceSimulation, 120);
  assert.equal(profile.geometry.markings.lineWidthSimulation, 1.6);
  assert.equal(profile.renderer.exposure, 1.12);
  assert.equal(profile.pitchStyles.midnight.environment.exposure, 1.22);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.geometry.goal), true);
  assert.equal(Object.isFrozen(profile.camera.position), true);
  assert.equal(Object.isFrozen(profile.lighting.flood.shadowBounds), true);
  assert.equal(Object.isFrozen(profile.pitchStyles.classic.environment), true);
});

test("Three scene environment profile validation rejects invalid geometry", () => {
  const invalid = invalidProfile((profile) => {
    profile.geometry.field.right = profile.geometry.field.left;
  });
  assert.throws(() => createThreeSceneEnvironmentProfile(invalid), /field bounds/);
});

const invalidCases = [
  ["camera fov outside perspective range", (profile) => { profile.camera.fov = 180; }, /camera\.fov.*less than 180/],
  ["camera position is not finite", (profile) => { profile.camera.position.x = Number.NaN; }, /camera\.position\.x.*finite/],
  ["low-power camera position is not finite", (profile) => { profile.camera.lowPowerPosition.z = Infinity; }, /camera\.lowPowerPosition\.z.*finite/],
  ["hemisphere sky color is invalid", (profile) => { profile.lighting.hemisphere.skyColor = -1; }, /lighting\.hemisphere\.skyColor.*24-bit/],
  ["hemisphere intensity is negative", (profile) => { profile.lighting.hemisphere.intensity = -0.1; }, /lighting\.hemisphere\.intensity.*zero or greater/],
  ["flood position is not finite", (profile) => { profile.lighting.flood.position.y = Number.NaN; }, /lighting\.flood\.position\.y.*finite/],
  ["flood shadow map size is not positive", (profile) => { profile.lighting.flood.shadowMapSize = 0; }, /lighting\.flood\.shadowMapSize.*greater than zero/],
  ["flood shadow map size is not a power of two", (profile) => { profile.lighting.flood.shadowMapSize = 300; }, /lighting\.flood\.shadowMapSize.*power of two/],
  ["low-power shadow map size is not a power of two", (profile) => { profile.lighting.flood.lowPowerShadowMapSize = 513; }, /lighting\.flood\.lowPowerShadowMapSize.*power of two/],
  ["flood shadow bounds are inverted", (profile) => { profile.lighting.flood.shadowBounds.right = profile.lighting.flood.shadowBounds.left; }, /lighting\.flood\.shadowBounds.*invalid/],
  ["flood shadow bias is not finite", (profile) => { profile.lighting.flood.shadowBias = Infinity; }, /lighting\.flood\.shadowBias.*finite/],
  ["rim color is invalid", (profile) => { profile.lighting.rim.color = 0x1000000; }, /lighting\.rim\.color.*24-bit/],
  ["rim position is not finite", (profile) => { profile.lighting.rim.position.z = Number.NaN; }, /lighting\.rim\.position\.z.*finite/],
  ["stadium intensity is negative", (profile) => { profile.lighting.stadium.intensity = -1; }, /lighting\.stadium\.intensity.*zero or greater/],
  ["pitch environment exposure is not positive", (profile) => { profile.pitchStyles.classic.environment.exposure = 0; }, /pitchStyles\.classic\.environment\.exposure.*greater than zero/],
  ["pitch environment flood intensity is negative", (profile) => { profile.pitchStyles.classic.environment.flood = -1; }, /pitchStyles\.classic\.environment\.flood.*zero or greater/],
];

for (const [name, mutate, expected] of invalidCases) {
  test(`Three scene environment profile rejects ${name}`, () => {
    assert.throws(() => createThreeSceneEnvironmentProfile(invalidProfile(mutate)), expected);
  });
}
