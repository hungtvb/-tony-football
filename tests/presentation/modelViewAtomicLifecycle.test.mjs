import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createBrowserModelViewAdapter } from "../../src/game/presentation/BrowserModelViewAdapter.js";
import { createPlayerModelView } from "../../src/game/presentation/PlayerModelView.js";

function canvasContext() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineCap: "", lineJoin: "", font: "",
    textAlign: "", textBaseline: "", globalAlpha: 1,
    clearRect() {}, fillRect() {}, roundRect() {}, fill() {}, stroke() {}, strokeText() {}, fillText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {}, closePath() {},
    save() {}, restore() {}, translate() {}, rotate() {},
  };
}
function documentStub() {
  const status = { className: "", textContent: "", title: "" };
  return { status, getElementById: (id) => id === "assetStatus" ? status : null, createElement: () => ({ width: 0, height: 0, getContext: () => canvasContext() }) };
}
function scenePort() {
  const objects = new Set();
  return { objects, addObject(object) { objects.add(object); return true; }, removeObject(object) { return objects.delete(object); }, copyCameraQuaternion(target) { target.set(0, 0, 0, 1); return true; }, diagnostics: () => Object.freeze({ maxAnisotropy: 1 }) };
}
function deferred() {
  let resolve; let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
function disposableScene(onDispose) {
  return { traverse(visitor) { visitor({ geometry: { dispose: onDispose }, material: null }); } };
}
function candidateModel({ onMaterialDispose = () => {}, onGeometryDispose = () => {} } = {}) {
  const geometry = new THREE.BoxGeometry(1, 1, 1); const disposeGeometry = geometry.dispose.bind(geometry);
  geometry.dispose = () => { onGeometryDispose(); disposeGeometry(); };
  const sourceMaterial = new THREE.MeshStandardMaterial();
  sourceMaterial.clone = () => {
    const material = new THREE.MeshStandardMaterial(); const disposeMaterial = material.dispose.bind(material);
    material.dispose = () => { onMaterialDispose(); disposeMaterial(); };
    return material;
  };
  const model = new THREE.Group(); model.add(new THREE.Mesh(geometry, sourceMaterial)); return model;
}
function snapshot() {
  return createMatchSnapshot({
    tick: 1,
    match: { state: "playing", elapsed: 1 / 60, matchSeconds: 150, score: [0, 0], selectedPlayerId: "home-0", settings: { ballStyle: "classic" }, replay: { active: false } },
    players: [{ id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, x: 100, y: 300, vx: 40, vy: 0, dirX: 1, dirY: 0, anim: "idle", animTime: 0, animDuration: 1, animPower: 0, stepPhase: 1, sprinting: false, motionYaw: Math.PI / 2, turnLean: 0 }],
    ball: { id: "match-ball", ownerId: "home-0", x: 140, y: 300, vx: 0, vy: 0, height: 0, angle: 0, spin: 0 },
  });
}
function frame(current) {
  return Object.freeze({ previousSnapshot: current, snapshot: current, alpha: .5, nowMilliseconds: 1000, controlMode: "attack", activeCharge: null, pressedCodes: Object.freeze([]) });
}
const descriptor = Object.freeze({ id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, dirX: 1, dirY: 0 });
const flush = () => new Promise((resolve) => setImmediate(resolve));

function createAdapter(overrides = {}) {
  const port = scenePort();
  return createBrowserModelViewAdapter({
    target: { location: { search: "" }, navigator: {}, matchMedia: () => ({ matches: false }) },
    document: documentStub(), getScenePort: () => port, isSceneBound: () => true,
    createBallView: () => ({ attach() {}, render() {}, reset() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }),
    ...overrides,
  });
}

test("reset ignores stale animation completion and refreshes clips without replacing the live character template", async () => {
  const firstAnimation = deferred(); const secondAnimation = deferred(); const installedAnimations = [];
  let animationLoadCount = 0; let characterLoadCount = 0; let staleMotionDisposals = 0;
  const characterScene = disposableScene(() => {});
  const adapter = createAdapter({
    assetLoader: {
      loadCharacter: async () => { characterLoadCount += 1; return { scene: characterScene }; },
      loadAnimations: () => (++animationLoadCount === 1 ? firstAnimation.promise : secondAnimation.promise),
    },
    createPlayerView: () => ({ attach() {}, render() {}, reset() {}, installAsset() {}, installAnimations: (clips) => installedAnimations.push(clips.map((clip) => clip.name)), teardown() {} }),
  });
  adapter.attach(); const current = snapshot(); adapter.render(frame(current)); await flush(); await flush();
  assert.equal(characterLoadCount, 1); assert.equal(animationLoadCount, 1);
  assert.equal(adapter.reset(), true); assert.equal(characterLoadCount, 1); assert.equal(animationLoadCount, 2);
  firstAnimation.resolve({ animations: [{ name: "Stale" }], scene: disposableScene(() => { staleMotionDisposals += 1; }) }); await flush(); await flush();
  assert.equal(staleMotionDisposals, 1); assert.deepEqual(installedAnimations, []);
  secondAnimation.resolve({ animations: [{ name: "Idle_Loop" }], scene: disposableScene(() => {}) }); await flush(); await flush();
  assert.deepEqual(installedAnimations, [["Idle_Loop"]]); adapter.teardown();
});

test("teardown observes and disposes deferred animation completion without installing it", async () => {
  const animation = deferred(); let installed = 0; let disposedLate = 0;
  const adapter = createAdapter({
    assetLoader: { loadCharacter: async () => ({ scene: disposableScene(() => {}) }), loadAnimations: () => animation.promise },
    createPlayerView: () => ({ attach() {}, render() {}, installAsset() {}, installAnimations() { installed += 1; }, teardown() {} }),
  });
  adapter.attach(); const current = snapshot(); adapter.render(frame(current)); await flush(); await flush(); adapter.teardown();
  animation.resolve({ animations: [{ name: "Idle_Loop" }], scene: disposableScene(() => { disposedLate += 1; }) }); await flush(); await flush();
  assert.equal(disposedLate, 1); assert.equal(installed, 0); assert.equal(adapter.diagnostics().disposed, true);
});

test("reset retains shared template geometry until dependent rigs are torn down", async () => {
  let characterLoadCount = 0; let geometryDisposals = 0;
  const geometry = new THREE.BoxGeometry(1, 1, 1); const disposeGeometry = geometry.dispose.bind(geometry);
  geometry.dispose = () => { geometryDisposals += 1; disposeGeometry(); };
  const characterScene = new THREE.Group(); characterScene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
  const adapter = createAdapter({
    assetLoader: { loadCharacter: async () => { characterLoadCount += 1; return { scene: characterScene }; }, loadAnimations: async () => ({ animations: [] }) },
    createPlayerView: (options) => createPlayerModelView({ ...options, cloneModel: (source) => source.clone(true) }),
  });
  adapter.attach(); const current = snapshot(); adapter.render(frame(current)); await flush(); await flush();
  assert.equal(characterLoadCount, 1); assert.equal(geometryDisposals, 0);
  assert.equal(adapter.reset(), true); await flush(); await flush();
  assert.equal(characterLoadCount, 1); assert.equal(geometryDisposals, 0);
  assert.equal(adapter.teardown(), true); assert.equal(geometryDisposals, 1);
});

test("teardown retains failed owners and resumes reverse cleanup after recovery", async () => {
  const order = []; let playerRecovered = false; let ballRecovered = false; let templateRecovered = false;
  const adapter = createAdapter({
    assetLoader: {
      loadCharacter: async () => ({ scene: disposableScene(() => { order.push("template"); if (!templateRecovered) throw new Error("template cleanup failed"); }) }),
      loadAnimations: async () => ({ animations: [] }),
    },
    createPlayerView: () => ({
      attach() {}, render() {}, installAsset() {}, installAnimations() {},
      teardown() { order.push("player"); if (!playerRecovered) throw new Error("player cleanup failed"); return true; },
    }),
    createBallView: () => ({
      attach() {}, render() {}, reset() {},
      teardown() { order.push("ball"); if (!ballRecovered) throw new Error("ball cleanup failed"); return true; },
      diagnostics: () => Object.freeze({ attached: true }),
    }),
  });
  adapter.attach(); const current = snapshot(); adapter.render(frame(current)); await flush(); await flush();

  assert.throws(() => adapter.teardown(), /player cleanup failed/);
  assert.deepEqual(order, ["player"]);
  assert.equal(adapter.diagnostics().terminating, true); assert.equal(adapter.diagnostics().disposed, false); assert.equal(adapter.diagnostics().playerCount, 1);

  playerRecovered = true;
  assert.throws(() => adapter.teardown(), /ball cleanup failed/);
  assert.deepEqual(order, ["player", "player", "ball"]);
  assert.equal(adapter.diagnostics().playerCount, 0); assert.equal(adapter.diagnostics().disposed, false);

  ballRecovered = true;
  assert.throws(() => adapter.teardown(), /template cleanup failed/);
  assert.deepEqual(order, ["player", "player", "ball", "ball", "template"]);
  assert.equal(adapter.diagnostics().disposed, false);

  templateRecovered = true;
  assert.equal(adapter.teardown(), true);
  assert.deepEqual(order, ["player", "player", "ball", "ball", "template", "template"]);
  assert.equal(adapter.diagnostics().disposed, true); assert.equal(adapter.diagnostics().playerCount, 0);
  assert.equal(adapter.teardown(), false);
});

test("fallback-to-rig preparation failure disposes candidate materials and preserves procedural fallback", () => {
  let materialDisposals = 0; let geometryDisposals = 0;
  const candidate = candidateModel({ onMaterialDispose: () => { materialDisposals += 1; }, onGeometryDispose: () => { geometryDisposals += 1; } });
  class FailingAnimationMixer { clipAction() { throw new Error("clip action failed"); } stopAllAction() {} }
  const view = createPlayerModelView({ player: descriptor, scenePort: scenePort(), document: documentStub(), worldX: (value) => value, worldZ: (value) => value, three: { ...THREE, AnimationMixer: FailingAnimationMixer }, cloneModel: () => candidate });
  const proceduralBody = view.root.children[0];
  assert.equal(view.installAsset({ characterScene: new THREE.Group(), animations: [{ name: "Idle_Loop" }] }), false);
  assert.equal(view.rigged, false); assert.equal(proceduralBody.visible, true); assert.equal(candidate.parent, null);
  assert.equal(materialDisposals, 1); assert.equal(geometryDisposals, 0); assert.match(view.diagnostics().installError, /clip action failed/);
  assert.equal(view.teardown(), true);
});

test("fallback-to-rig root commit failure removes a partially attached candidate", () => {
  let materialDisposals = 0; let geometryDisposals = 0;
  const candidate = candidateModel({ onMaterialDispose: () => { materialDisposals += 1; }, onGeometryDispose: () => { geometryDisposals += 1; } });
  const view = createPlayerModelView({ player: descriptor, scenePort: scenePort(), document: documentStub(), worldX: (value) => value, worldZ: (value) => value, cloneModel: () => candidate });
  const proceduralBody = view.root.children[0]; const originalAdd = view.root.add.bind(view.root);
  view.root.add = (object) => { originalAdd(object); if (object === candidate) throw new Error("root add failed"); return view.root; };
  assert.equal(view.installAsset({ characterScene: new THREE.Group(), animations: [] }), false);
  assert.equal(view.rigged, false); assert.equal(proceduralBody.visible, true); assert.equal(candidate.parent, null);
  assert.equal(materialDisposals, 1); assert.equal(geometryDisposals, 0); assert.match(view.diagnostics().installError, /root add failed/);
  assert.equal(view.teardown(), true);
});

test("fallback-to-rig upgrade commits the detached candidate atomically", () => {
  const candidate = candidateModel(); const port = scenePort();
  const view = createPlayerModelView({ player: descriptor, scenePort: port, document: documentStub(), worldX: (value) => value, worldZ: (value) => value, cloneModel: () => candidate });
  const proceduralBody = view.root.children[0];
  assert.equal(view.attach(), true); assert.equal(view.installAsset({ characterScene: new THREE.Group(), animations: [] }), true);
  assert.equal(view.rigged, true); assert.equal(proceduralBody.visible, false); assert.equal(candidate.parent, view.root); assert.equal(view.diagnostics().installError, "");
  assert.equal(view.teardown(), true); assert.equal(port.objects.size, 0);
});

function mixerOwnershipSpy() {
  const mixers = []; let failingClipName = "";
  class Mixer {
    constructor(model) {
      this.model = model; this.cached = new Set(); this.scheduled = new Set(); this.uncacheRootCalls = 0;
      mixers.push(this);
    }
    clipAction(clip) {
      if (clip.name === failingClipName) throw new Error(`clip action failed for ${clip.name}`);
      const mixer = this;
      const action = {
        clip, enabled: false, clampWhenFinished: false, timeScale: 1,
        reset() { return this; },
        setLoop() { return this; },
        fadeIn() { return this; },
        fadeOut() { return this; },
        play() { mixer.scheduled.add(this); return this; },
        stop() { mixer.scheduled.delete(this); return this; },
      };
      this.cached.add(action); return action;
    }
    stopAllAction() { this.scheduled.clear(); return this; }
    uncacheRoot(root) {
      assert.equal(root, this.model);
      this.uncacheRootCalls += 1; this.cached.clear(); this.scheduled.clear();
    }
    update() {}
  }
  return {
    three: { ...THREE, AnimationMixer: Mixer },
    mixers,
    failOnClip(name) { failingClipName = name; },
  };
}

test("animation refresh swaps an isolated mixer and reset never accumulates scheduled actions", () => {
  const ownership = mixerOwnershipSpy(); const candidate = candidateModel();
  const view = createPlayerModelView({
    player: descriptor, scenePort: scenePort(), document: documentStub(),
    worldX: (value) => value, worldZ: (value) => value,
    three: ownership.three, cloneModel: () => candidate,
  });

  assert.equal(view.installAsset({ characterScene: new THREE.Group(), animations: [{ name: "Idle_Loop" }] }), true);
  assert.equal(ownership.mixers.length, 1); assert.equal(ownership.mixers[0].scheduled.size, 1);

  assert.equal(view.reset(), true); assert.equal(view.reset(), true);
  assert.equal(ownership.mixers[0].scheduled.size, 1);

  assert.equal(view.installAnimations([{ name: "Idle_Loop" }, { name: "Jog_Fwd_Loop" }]), true);
  assert.equal(ownership.mixers.length, 2);
  assert.equal(ownership.mixers[0].scheduled.size, 0); assert.equal(ownership.mixers[0].cached.size, 0); assert.equal(ownership.mixers[0].uncacheRootCalls, 1);
  assert.equal(ownership.mixers[1].scheduled.size, 1); assert.equal(ownership.mixers[1].cached.size, 2);

  ownership.failOnClip("Broken");
  assert.equal(view.installAnimations([{ name: "Idle_Loop" }, { name: "Broken" }]), false);
  assert.equal(ownership.mixers.length, 3);
  assert.equal(ownership.mixers[1].scheduled.size, 1); assert.equal(ownership.mixers[1].cached.size, 2);
  assert.equal(ownership.mixers[2].scheduled.size, 0); assert.equal(ownership.mixers[2].cached.size, 0); assert.equal(ownership.mixers[2].uncacheRootCalls, 1);
  assert.match(view.diagnostics().installError, /clip action failed for Broken/);

  assert.equal(view.teardown(), true);
  assert.equal(ownership.mixers[1].scheduled.size, 0); assert.equal(ownership.mixers[1].cached.size, 0); assert.equal(ownership.mixers[1].uncacheRootCalls, 1);
});
