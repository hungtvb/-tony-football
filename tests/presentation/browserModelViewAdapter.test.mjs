import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../../src/game/config/simulationScaleProfile.js";
import { createBrowserModelViewAdapter } from "../../src/game/presentation/BrowserModelViewAdapter.js";

function snapshot({ tick = 1, x = 100, ballX = 140 } = {}) {
  return createMatchSnapshot({
    tick,
    match: { state: "playing", elapsed: tick / 60, matchSeconds: 150, score: [0, 0], selectedPlayerId: "home-0", settings: { ballStyle: "classic" }, replay: { active: false } },
    players: [{ id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, x, y: 300, vx: 40, vy: 0, dirX: 1, dirY: 0, anim: "idle", animTime: 0, animDuration: 1, animPower: 0, stepPhase: 1, sprinting: false, motionYaw: Math.PI / 2, turnLean: 0 }],
    ball: { id: "match-ball", ownerId: "home-0", x: ballX, y: 300, vx: 0, vy: 0, height: 0, angle: 0, spin: 0 },
  });
}
function frame(previous, current, overrides = {}) {
  return Object.freeze({ previousSnapshot: previous, snapshot: current, alpha: .5, nowMilliseconds: 1000, controlMode: "attack", activeCharge: Object.freeze({ code: "KeyD", power: .5, modifiers: Object.freeze({ q: false, z: false }) }), pressedCodes: Object.freeze(["KeyD"]), ...overrides });
}
function fakeDocument() {
  const status = { className: "", textContent: "", title: "" };
  return { status, getElementById: (id) => id === "assetStatus" ? status : null, createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) };
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
function disposableScene(onDispose) {
  return { traverse(visitor) { visitor({ geometry: { dispose: onDispose }, material: null }); } };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("default model projection follows the metric scale profile", () => {
  let projected = null;
  const adapter = createBrowserModelViewAdapter({
    target: { location: { search: "?visualTest=1" }, navigator: {}, matchMedia: () => ({ matches: false }) },
    document: fakeDocument(),
    getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }),
    isSceneBound: () => true,
    createPlayerView: ({ worldX, worldZ }) => {
      projected = Object.freeze({ x: worldX(620), z: worldZ(370) });
      return { attach() {}, render() {}, teardown() {}, diagnostics: () => Object.freeze({ id: "home-0", rigged: false }) };
    },
    createBallView: () => ({ attach() {}, render() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }),
    assetLoader: { loadCharacter: async () => ({}), loadAnimations: async () => ({}) },
  });
  adapter.attach();
  const current = snapshot({ x: 620, ballX: 620 });
  adapter.render(frame(current, current));
  assert.deepEqual(projected, { x: 1, z: 1 });
  assert.deepEqual(adapter.diagnostics().projection, {
    profileId: DEFAULT_SIMULATION_SCALE_PROFILE.id,
    width: 1200,
    height: 700,
    scale: .05,
  });
  adapter.teardown();
});

test("model adapter lazily attaches after the scene binds and renders immutable snapshot facts", async () => {
  const calls = []; const document = fakeDocument(); const target = { location: { search: "" }, navigator: { deviceMemory: 8 }, matchMedia: () => ({ matches: false }) };
  let bound = false; const scenePort = { addObject() { return true; }, removeObject() { return true; } }; const characterScene = { traverse() {} }; const animations = [{ name: "Idle_Loop" }, { name: "Jog_Fwd_Loop" }];
  const adapter = createBrowserModelViewAdapter({
    target, document, getScenePort: () => scenePort, isSceneBound: () => bound,
    assetLoader: { loadCharacter: async () => ({ scene: characterScene }), loadAnimations: async () => ({ animations }) },
    createPlayerView: ({ player }) => {
      assert.equal(Object.isFrozen(player), true);
      return { attach: () => calls.push("player:attach"), installAsset: ({ characterScene: installed }) => { assert.equal(installed, characterScene); calls.push("player:asset"); }, installAnimations: (installed) => { assert.equal(installed.length, 2); calls.push("player:animations"); }, render: (facts) => { assert.equal(Object.isFrozen(facts.player), true); assert.equal(Object.isFrozen(facts.ball), true); assert.equal(Object.isFrozen(facts.pressedCodes), true); calls.push(["player:render", facts.player.x]); }, reset: () => calls.push("player:reset"), teardown: () => calls.push("player:teardown") };
    },
    createBallView: () => ({ attach: () => calls.push("ball:attach"), render: (facts) => { assert.equal(Object.isFrozen(facts.ball), true); assert.equal(Object.isFrozen(facts.selectedPlayer), true); assert.equal(Object.isFrozen(facts.activeCharge), true); calls.push(["ball:render", facts.ball.x]); }, reset: () => calls.push("ball:reset"), teardown: () => calls.push("ball:teardown"), diagnostics: () => Object.freeze({ attached: true }) }),
  });
  assert.equal(adapter.attach(), false); bound = true;
  const previous = snapshot({ tick: 1, x: 100, ballX: 140 }); const current = snapshot({ tick: 2, x: 120, ballX: 160 });
  assert.equal(adapter.render(frame(previous, current)), true); await flush(); await flush();
  assert.deepEqual(calls.slice(0, 4), ["ball:attach", "player:attach", ["player:render", 110], ["ball:render", 150]]);
  assert.equal(calls.includes("player:asset"), true); assert.equal(calls.includes("player:animations"), true); assert.equal(adapter.diagnostics().playerCount, 1); assert.equal(adapter.diagnostics().assetState, "ready"); assert.equal(document.status.textContent, "PLAYER V3 + MOTION · READY");
  assert.equal(adapter.reset(), true); await flush(); await flush(); assert.equal(adapter.teardown(), true); assert.equal(calls.includes("player:reset"), true); assert.equal(calls.includes("ball:reset"), true); assert.equal(calls.includes("player:teardown"), true); assert.equal(calls.includes("ball:teardown"), true);
});

test("character loading failure keeps procedural views active", async () => {
  const calls = []; const document = fakeDocument(); const target = { location: { search: "" }, navigator: {}, matchMedia: () => ({ matches: false }) };
  const adapter = createBrowserModelViewAdapter({ target, document, getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }), isSceneBound: () => true, assetLoader: { loadCharacter: async () => { throw new Error("character unavailable"); }, loadAnimations: async () => { throw new Error("must not load"); } }, createPlayerView: () => ({ attach() {}, render() { calls.push("procedural:render"); }, teardown() {} }), createBallView: () => ({ attach() {}, render() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }) });
  assert.equal(adapter.attach(), true); const current = snapshot(); adapter.render(frame(current, current, { activeCharge: null, pressedCodes: Object.freeze([]) })); await flush();
  assert.equal(calls.includes("procedural:render"), true); assert.equal(adapter.diagnostics().assetState, "error"); assert.match(adapter.diagnostics().assetDetail, /character unavailable/); assert.equal(document.status.textContent, "MODEL · FALLBACK"); adapter.teardown();
});

test("reset invalidates deferred character work and restarts one fresh generation", async () => {
  const first = deferred(); const second = deferred(); const animation = deferred(); const installed = []; let disposedLate = 0; let loadCount = 0;
  const adapter = createBrowserModelViewAdapter({
    target: { location: { search: "" }, navigator: {}, matchMedia: () => ({ matches: false }) },
    document: fakeDocument(),
    getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }),
    isSceneBound: () => true,
    assetLoader: { loadCharacter: () => (++loadCount === 1 ? first.promise : second.promise), loadAnimations: () => animation.promise },
    createPlayerView: () => ({ attach() {}, render() {}, reset() {}, installAsset: ({ characterScene }) => installed.push(characterScene), installAnimations() {}, teardown() {} }),
    createBallView: () => ({ attach() {}, render() {}, reset() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }),
  });
  adapter.attach(); const current = snapshot(); adapter.render(frame(current, current));
  assert.equal(adapter.reset(), true);
  const staleScene = disposableScene(() => { disposedLate += 1; });
  first.resolve({ scene: staleScene }); await flush(); await flush();
  assert.equal(disposedLate, 1); assert.equal(installed.includes(staleScene), false);
  const freshScene = disposableScene(() => {});
  second.resolve({ scene: freshScene }); await flush();
  animation.resolve({ animations: [{ name: "Idle_Loop" }], scene: disposableScene(() => {}) }); await flush(); await flush();
  assert.deepEqual(installed, [freshScene]); assert.equal(adapter.diagnostics().animationClips, 1);
  adapter.teardown();
});

test("teardown disposes deferred character completion without reattaching it", async () => {
  const character = deferred(); let disposedLate = 0; let installed = 0;
  const adapter = createBrowserModelViewAdapter({
    target: { location: { search: "" }, navigator: {}, matchMedia: () => ({ matches: false }) },
    document: fakeDocument(),
    getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }),
    isSceneBound: () => true,
    assetLoader: { loadCharacter: () => character.promise, loadAnimations: async () => ({ animations: [] }) },
    createPlayerView: () => ({ attach() {}, render() {}, installAsset() { installed += 1; }, teardown() {} }),
    createBallView: () => ({ attach() {}, render() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }),
  });
  adapter.attach(); const current = snapshot(); adapter.render(frame(current, current)); adapter.teardown();
  character.resolve({ scene: disposableScene(() => { disposedLate += 1; }) }); await flush(); await flush();
  assert.equal(disposedLate, 1); assert.equal(installed, 0); assert.equal(adapter.diagnostics().disposed, true);
});

test("model adapter retains a player view whose teardown needs a later retry", () => {
  let playerTeardownAttempts = 0; let ballTeardownAttempts = 0; let recovered = false;
  const adapter = createBrowserModelViewAdapter({
    target: { location: { search: "?visualTest=1" }, navigator: {}, matchMedia: () => ({ matches: false }) },
    document: fakeDocument(),
    getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }),
    isSceneBound: () => true,
    createPlayerView: () => ({
      attach() {}, render() {},
      teardown() {
        playerTeardownAttempts += 1;
        if (!recovered) throw new Error("player cleanup failed");
        return true;
      },
    }),
    createBallView: () => ({
      attach() {}, render() {},
      teardown() { ballTeardownAttempts += 1; return true; },
      diagnostics: () => Object.freeze({ attached: true }),
    }),
    assetLoader: { loadCharacter: async () => ({}), loadAnimations: async () => ({}) },
  });
  adapter.attach(); const current = snapshot(); adapter.render(frame(current, current));

  assert.throws(() => adapter.teardown(), /player cleanup failed/);
  assert.equal(adapter.diagnostics().terminating, true);
  assert.equal(adapter.diagnostics().disposed, false);
  assert.equal(adapter.diagnostics().playerCount, 1);
  assert.equal(ballTeardownAttempts, 0);
  assert.equal(adapter.render(frame(current, current)), false);

  assert.throws(() => adapter.teardown(), /player cleanup failed/);
  assert.equal(playerTeardownAttempts, 2);
  assert.equal(adapter.diagnostics().playerCount, 1);

  recovered = true;
  assert.equal(adapter.teardown(), true);
  assert.equal(playerTeardownAttempts, 3);
  assert.equal(ballTeardownAttempts, 1);
  assert.equal(adapter.diagnostics().playerCount, 0);
  assert.equal(adapter.diagnostics().disposed, true);
  assert.equal(adapter.diagnostics().terminating, false);
  assert.equal(adapter.teardown(), false);
});

test("model adapter rejects mutable presentation frames", () => {
  const adapter = createBrowserModelViewAdapter({ target: { location: { search: "?visualTest=1" }, navigator: {}, matchMedia: () => ({ matches: false }) }, document: fakeDocument(), getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }), isSceneBound: () => true, createPlayerView: () => ({ attach() {}, render() {}, teardown() {} }), createBallView: () => ({ attach() {}, render() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }), assetLoader: { loadCharacter: async () => ({}), loadAnimations: async () => ({}) } });
  adapter.attach(); assert.throws(() => adapter.render({}), /immutable snapshots/); adapter.teardown();
});
