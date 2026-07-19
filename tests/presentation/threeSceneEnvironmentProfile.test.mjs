import assert from "node:assert/strict";
import test from "node:test";

import {
  createThreeSceneEnvironmentProfile,
  DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE,
} from "../../src/game/presentation/ThreeSceneEnvironmentProfile.js";

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

test("Three scene environment profile validation rejects invalid geometry", () => {
  const invalid = structuredClone(DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE);
  invalid.geometry.field.right = invalid.geometry.field.left;
  assert.throws(() => createThreeSceneEnvironmentProfile(invalid), /field bounds/);
});
