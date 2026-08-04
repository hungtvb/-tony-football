import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createBrowserThreeSceneEnvironmentHost } from "../../src/game/presentation/BrowserThreeSceneEnvironmentHost.js";
import { DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE } from "../../src/game/presentation/ThreeSceneEnvironmentProfile.js";

function createPaintContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({ createLinearGradient: () => gradient }, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
}

function createDocument() {
  return {
    createElement(name) {
      assert.equal(name, "canvas");
      return { width: 0, height: 0, getContext: () => createPaintContext() };
    },
  };
}

function createRenderer(log) {
  return {
    shadowMap: {},
    capabilities: { getMaxAnisotropy: () => 8 },
    setPixelRatio() {},
    setSize() {},
    render() { log.push("render"); },
    dispose() { log.push("renderer:dispose"); },
    forceContextLoss() { log.push("renderer:context-loss"); },
  };
}

function frame() {
  return Object.freeze({
    snapshot: Object.freeze({
      match: Object.freeze({
        settings: Object.freeze({ pitchStyle: "classic", weather: "clear" }),
        replay: Object.freeze({ active: false }),
      }),
    }),
    nowMilliseconds: 16,
  });
}

test("clean host starts, renders, preserves foreign resources on teardown and restarts", () => {
  const log = [];
  const canvas = { width: 1200, height: 700, clientWidth: 1200, clientHeight: 700 };
  const host = createBrowserThreeSceneEnvironmentHost({
    canvas,
    target: { devicePixelRatio: 1 },
    document: createDocument(),
    viewport: Object.freeze({ width: 1200, height: 700, pixelRatio: 1 }),
    lowPowerDevice: true,
    rendererFactory: () => createRenderer(log),
  });

  assert.equal(host.start(), true);
  assert.equal(host.port.diagnostics().owner, "clean-host");
  assert.equal(host.port.diagnostics().profile, DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE.id);
  assert.equal(host.port.diagnostics().geometry.worldScale, 0.05);

  let geometryDisposed = 0;
  let materialDisposed = 0;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  geometry.dispose = () => { geometryDisposed += 1; };
  material.dispose = () => { materialDisposed += 1; };
  const foreign = new THREE.Mesh(geometry, material);
  assert.equal(host.port.addObject(foreign), true);
  assert.equal(host.port.diagnostics().foreignObjects, 1);
  assert.equal(host.render(frame()), true);
  assert.equal(log.includes("render"), true);

  assert.equal(host.dispose(), true);
  assert.equal(geometryDisposed, 0);
  assert.equal(materialDisposed, 0);
  assert.equal(host.port.diagnostics().renderer, "unavailable");

  assert.equal(host.start(), true);
  assert.equal(host.port.diagnostics().owner, "clean-host");
  assert.equal(host.dispose(), true);
});
