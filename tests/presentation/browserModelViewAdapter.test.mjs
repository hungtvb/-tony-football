import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
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
const flush = () => new Promise((resolve) => setImmediate(resolve));

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
  assert.equal(calls.includes("player:asset"), true); assert.equal(calls.includes("player:animations"), true); assert.equal(adapter.diagnostics().playerCount, 1); assert.equal(adapter.diagnostics().assetState, "ready"); assert.equal(document.status.textContent, "PLAYER RIG · READY");
  assert.equal(adapter.reset(), true); assert.equal(adapter.teardown(), true); assert.equal(calls.includes("player:reset"), true); assert.equal(calls.includes("ball:reset"), true); assert.equal(calls.includes("player:teardown"), true); assert.equal(calls.includes("ball:teardown"), true);
});

test("character loading failure keeps procedural views active", async () => {
  const calls = []; const document = fakeDocument(); const target = { location: { search: "" }, navigator: {}, matchMedia: () => ({ matches: false }) };
  const adapter = createBrowserModelViewAdapter({ target, document, getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }), isSceneBound: () => true, assetLoader: { loadCharacter: async () => { throw new Error("character unavailable"); }, loadAnimations: async () => { throw new Error("must not load"); } }, createPlayerView: () => ({ attach() {}, render() { calls.push("procedural:render"); }, teardown() {} }), createBallView: () => ({ attach() {}, render() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }) });
  assert.equal(adapter.attach(), true); const current = snapshot(); adapter.render(frame(current, current, { activeCharge: null, pressedCodes: Object.freeze([]) })); await flush();
  assert.equal(calls.includes("procedural:render"), true); assert.equal(adapter.diagnostics().assetState, "error"); assert.match(adapter.diagnostics().assetDetail, /character unavailable/); assert.equal(document.status.textContent, "MODEL · FALLBACK"); adapter.teardown();
});

test("model adapter rejects mutable presentation frames", () => {
  const adapter = createBrowserModelViewAdapter({ target: { location: { search: "?visualTest=1" }, navigator: {}, matchMedia: () => ({ matches: false }) }, document: fakeDocument(), getScenePort: () => ({ addObject() { return true; }, removeObject() { return true; } }), isSceneBound: () => true, createPlayerView: () => ({ attach() {}, render() {}, teardown() {} }), createBallView: () => ({ attach() {}, render() {}, teardown() {}, diagnostics: () => Object.freeze({ attached: true }) }), assetLoader: { loadCharacter: async () => ({}), loadAnimations: async () => ({}) } });
  adapter.attach(); assert.throws(() => adapter.render({}), /immutable snapshots/); adapter.teardown();
});
