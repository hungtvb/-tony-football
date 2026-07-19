import assert from "node:assert/strict";
import test from "node:test";

import { createLegacyAdoptedThreeSceneHost } from "../../src/game/presentation/LegacyAdoptedThreeSceneHost.js";

function createResources({ composer = true } = {}) {
  const calls = [];
  const scene = {
    children: [],
    add(object) { this.children.push(object); calls.push(["add", object]); },
    remove(object) { this.children = this.children.filter((value) => value !== object); calls.push(["remove", object]); },
  };
  const camera = {
    aspect: 1,
    position: { set: (...values) => calls.push(["position", ...values]) },
    quaternion: { value: "camera-quaternion" },
    lookAt: (...values) => calls.push(["lookAt", ...values]),
    updateProjectionMatrix: () => calls.push(["projection"]),
  };
  const renderer = {
    setPixelRatio: (value) => calls.push(["pixelRatio", value]),
    setSize: (...values) => calls.push(["size", ...values]),
    render: (...values) => calls.push(["renderer:render", ...values]),
  };
  const composerValue = composer ? {
    setPixelRatio: (value) => calls.push(["composer:pixelRatio", value]),
    setSize: (...values) => calls.push(["composer:size", ...values]),
    render: () => calls.push(["composer:render"]),
  } : null;
  return {
    calls,
    resources: { renderer, scene, camera, composer: composerValue, environmentObjects: [{}, {}] },
  };
}

test("adopted host renders through the existing composer without creating or disposing a renderer", () => {
  const { calls, resources } = createResources();
  let scopeCalls = 0;
  const host = createLegacyAdoptedThreeSceneHost({
    legacyResources: resources,
    renderScope: (callback) => {
      scopeCalls += 1;
      return callback();
    },
  });

  assert.equal(host.start(), true);
  assert.equal(host.resize(Object.freeze({ width: 900, height: 525, pixelRatio: 2 })), true);
  assert.equal(host.render(Object.freeze({})), true);
  assert.equal(scopeCalls, 1);
  assert.equal(calls.some(([name]) => name === "composer:render"), true);
  assert.equal(calls.some(([name]) => name === "renderer:render"), false);
  assert.equal(host.dispose(), true);
  assert.equal(host.dispose(), false);
  assert.equal("dispose" in resources.renderer, false);
});

test("adopted host falls back to the existing renderer when no composer exists", () => {
  const { calls, resources } = createResources({ composer: false });
  const host = createLegacyAdoptedThreeSceneHost({ legacyResources: resources });
  host.start();
  host.render(Object.freeze({}));
  assert.equal(calls.some(([name]) => name === "renderer:render"), true);
});

test("adopted host port keeps object identity and immutable diagnostics", () => {
  const { resources } = createResources();
  let mutations = 0;
  const host = createLegacyAdoptedThreeSceneHost({
    legacyResources: resources,
    lowPowerDevice: true,
    mutationScope: (callback) => { mutations += 1; return callback(); },
  });
  host.start();
  const object = {};
  assert.equal(host.port.addObject(object), true);
  assert.equal(resources.scene.children[0], object);
  assert.equal(host.port.removeObject(object), true);
  assert.equal(mutations, 2);
  const destination = { copy: (value) => { destination.value = value; } };
  assert.equal(host.port.copyCameraQuaternion(destination), true);
  assert.equal(destination.value, resources.camera.quaternion);
  const diagnostics = host.port.diagnostics();
  assert.equal(Object.isFrozen(diagnostics), true);
  assert.equal(diagnostics.adopted, true);
  assert.equal(diagnostics.environmentObjects, 2);
  assert.equal(diagnostics.lowPowerDevice, true);
});

test("adopted host rejects incomplete resources", () => {
  assert.throws(() => createLegacyAdoptedThreeSceneHost({ legacyResources: {} }), /requires renderer, scene and camera/);
});
