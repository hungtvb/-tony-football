import assert from "node:assert/strict";
import test from "node:test";

import {
  activateLegacyThreeSceneOwnership,
  deactivateLegacyThreeSceneOwnership,
  installLegacyThreeSceneTracking,
  legacyThreeSceneSnapshot,
  ownedThreeSceneSnapshot,
  resetLegacyThreeSceneRegistryForTests,
  withLegacyThreeOwnedRender,
} from "../../src/game/presentation/LegacyThreeSceneRegistry.js";

class Scene {
  constructor() { this.children = []; }
  add(...objects) { this.children.push(...objects); return this; }
}
class Camera {
  lookAt(...values) { this.look = values; }
}
class Renderer {
  constructor() { this.renders = 0; }
  setSize() {}
  render() { this.renders += 1; return this.renders; }
}
class Composer {
  constructor() { this.renders = 0; }
  setSize() {}
  addPass() {}
  render() { this.renders += 1; return this.renders; }
}

test.afterEach(() => resetLegacyThreeSceneRegistryForTests());

test("legacy registry captures shared instances and suppresses only unowned render calls", () => {
  installLegacyThreeSceneTracking({ THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer }, EffectComposer: Composer });
  const scene = new Scene();
  const camera = new Camera();
  const renderer = new Renderer();
  const composer = new Composer();
  scene.add({ name: "player" });
  camera.lookAt(0, 0, 0);
  renderer.setSize(1200, 700);
  composer.setSize(1200, 700);

  const snapshot = legacyThreeSceneSnapshot();
  assert.equal(snapshot.scene, scene);
  assert.equal(snapshot.camera, camera);
  assert.equal(snapshot.renderer, renderer);
  assert.equal(snapshot.composer, composer);

  assert.equal(renderer.render(), 1);
  assert.equal(composer.render(), 1);
  activateLegacyThreeSceneOwnership();
  assert.equal(renderer.render(), undefined);
  assert.equal(composer.render(), undefined);
  assert.equal(renderer.renders, 1);
  assert.equal(composer.renders, 1);
  assert.equal(withLegacyThreeOwnedRender(() => renderer.render()), 2);
  assert.equal(withLegacyThreeOwnedRender(() => composer.render()), 2);
  deactivateLegacyThreeSceneOwnership();
  assert.equal(renderer.render(), 3);
});

test("active ownership forwards later legacy scene objects through the host port", () => {
  installLegacyThreeSceneTracking({ THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer }, EffectComposer: Composer });
  const scene = new Scene();
  const camera = new Camera();
  const renderer = new Renderer();
  scene.add({ name: "existing" });
  camera.lookAt(0, 0, 0);
  renderer.setSize(1200, 700);
  const forwarded = [];
  activateLegacyThreeSceneOwnership(Object.freeze({ addObject: (object) => forwarded.push(object) }));
  const late = { name: "late-model" };
  scene.add(late);
  assert.deepEqual(forwarded, [late]);
  assert.equal(scene.children.includes(late), false);
});

test("legacy registry distinguishes the adapter-owned scene and renderer", () => {
  installLegacyThreeSceneTracking({ THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer }, EffectComposer: Composer });
  const legacyScene = new Scene();
  const camera = new Camera();
  const legacyRenderer = new Renderer();
  legacyScene.add({ name: "legacy" });
  camera.lookAt(0, 0, 0);
  legacyRenderer.setSize(1200, 700);
  const ownedScene = new Scene();
  const ownedRenderer = new Renderer();
  ownedScene.add({ name: "environment" });
  ownedRenderer.setSize(1200, 700);
  assert.equal(legacyThreeSceneSnapshot().scene, legacyScene);
  assert.equal(legacyThreeSceneSnapshot().renderer, legacyRenderer);
  assert.equal(ownedThreeSceneSnapshot().scene, ownedScene);
  assert.equal(ownedThreeSceneSnapshot().renderer, ownedRenderer);
});

test("legacy registry installation is idempotent and restores prototypes for tests", () => {
  assert.equal(installLegacyThreeSceneTracking({ THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer }, EffectComposer: Composer }), true);
  assert.equal(installLegacyThreeSceneTracking({ THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer }, EffectComposer: Composer }), false);
  resetLegacyThreeSceneRegistryForTests();
  const renderer = new Renderer();
  activateLegacyThreeSceneOwnership();
  assert.equal(renderer.render(), 1);
});
