import assert from "node:assert/strict";
import test from "node:test";
import { createThreeSceneEnvironmentProfile, DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE } from "../../src/game/presentation/ThreeSceneEnvironmentProfile.js";

test("default Three scene environment profile is deeply frozen and preserves approved values", () => {
  const profile = DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE;
  assert.equal(profile.id, "tony-football-default-v1");
  assert.equal(profile.geometry.worldScale, 0.1);
  assert.deepEqual(profile.geometry.field, { left: 48, right: 1152, top: 42, bottom: 658 });
  assert.equal(profile.geometry.goal.width, 17);
  assert.equal(profile.renderer.exposure, 1.12);
  assert.equal(profile.pitchStyles.midnight.environment.exposure, 1.22);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.geometry.goal), true);
  assert.equal(Object.isFrozen(profile.pitchStyles.classic.environment), true);
});

test("Three scene environment profile rejects every invalid consumed camera, light and shadow family", () => {
  const cases = [
    ["camera position", (p) => { p.camera.position.x = Number.NaN; }, /camera.position.x/],
    ["camera fov", (p) => { p.camera.fov = 180; }, /fov/],
    ["hemisphere color", (p) => { p.lighting.hemisphere.skyColor = -1; }, /skyColor/],
    ["flood position", (p) => { p.lighting.flood.position.y = Infinity; }, /flood.position.y/],
    ["shadow map", (p) => { p.lighting.flood.shadowMapSize = 0; }, /shadowMapSize/],
    ["shadow bounds", (p) => { p.lighting.flood.shadowBounds.right = p.lighting.flood.shadowBounds.left; }, /shadow bounds/],
    ["shadow bias", (p) => { p.lighting.flood.shadowBias = Number.NaN; }, /shadowBias/],
    ["rim intensity", (p) => { p.lighting.rim.intensity = -1; }, /rim.intensity/],
    ["stadium intensity", (p) => { p.lighting.stadium.intensity = -1; }, /stadium.intensity/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const invalid = structuredClone(DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE);
    mutate(invalid);
    assert.throws(() => createThreeSceneEnvironmentProfile(invalid), pattern, name);
  }
});
