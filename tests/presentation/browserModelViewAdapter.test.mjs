import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createBrowserModelViewAdapter } from "../../src/game/presentation/BrowserModelViewAdapter.js";

function frame({ tick = 1, alpha = 0.5 } = {}) {
  const previous = createMatchSnapshot({
    tick: Math.max(0, tick - 1),
    match: {
      state: "playing",
      selectedPlayerId: "home-0",
      score: [0, 0],
      settings: { ballStyle: "classic" },
      replay: { active: false },
    },
    players: [
      { id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, x: 100, y: 200, vx: 20, vy: 0, dirX: 1, dirY: 0, anim: "idle", animTime: 0, animDuration: 1, animPower: 0, stepPhase: 0, sprinting: false, motionYaw: 0, turnLean: 0 },
      { id: "away-0", team: 1, index: 0, role: "DF", name: "VEX", number: 3, x: 500, y: 300, vx: 0, vy: 0, dirX: -1, dirY: 0, anim: "idle", animTime: 0, animDuration: 1, animPower: 0, stepPhase: 0, sprinting: false, motionYaw: 0, turnLean: 0 },
    ],
    ball: { id: "match-ball", x: 120, y: 200, vx: 10, vy: 0, height: 0, angle: 0, ownerId: "home-0", trail: [] },
  });
  const current = createMatchSnapshot({
    tick,
    match: {
      state: "playing",
      selectedPlayerId: "home-0",
      score: [0, 0],
      settings: { ballStyle: "volt" },
      replay: { active: false },
    },
    players: [
      { id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, x: 110, y: 200, vx: 40, vy: 0, dirX: 1, dirY: 0, anim: "shoot", animTime: 0.2, animDuration: 0.34, animPower: 0.8, stepPhase: 1, sprinting: true, motionYaw: 0, turnLean: 0.1 },
      { id: "away-0", team: 1, index: 0, role: "DF", name: "VEX", number: 3, x: 500, y: 300, vx: 0, vy: 0, dirX: -1, dirY: 0, anim: "idle", animTime: 0, animDuration: 1, animPower: 0, stepPhase: 0, sprinting: false, motionYaw: 0, turnLean: 0 },
    ],
    ball: { id: "match-ball", x: 130, y: 200, vx: 20, vy: 0, height: 0.1, angle: 0.2, ownerId: "home-0", trail: [] },
  });
  return Object.freeze({
    snapshot: current,
    previousSnapshot: previous,
    alpha,
    nowMilliseconds: 1000,
    controlMode: "attack",
    activeCharge: Object.freeze({ code: "KeyD", power: 0.9, modifiers: Object.freeze({ q: false, z: false }) }),
    pressedCodes: Object.freeze(["KeyD"]),
  });
}

function fakeDocument() {
  const nodes = new Map([
    ["assetStatus", { className: "", textContent: "", title: "" }],
    ["commentary", { textContent: "" }],
  ]);
  return { getElementById: (id) => nodes.get(id) ?? null, nodes };
}

function fakeViews(log) {
  return {
    createPlayerView({ player }) {
      const record = { playerId: player.id, installed: 0, animations: 0, resets: 0, tornDown: 0 };
      log.players.set(player.id, record);
      return {
        installCharacter(value) { assert.ok(value.scene); record.installed += 1; if (value.animations?.length) record.animations += 1; return true; },
        installAnimations(value) { assert.ok(Object.isFrozen(value)); record.animations += 1; return true; },
        render(pose, facts) {
          assert.ok(Object.isFrozen(pose));
          assert.ok(Object.isFrozen(facts));
          assert.ok(Object.isFrozen(facts.pressedCodes));
          record.pose = pose;
          record.facts = facts;
          return true;
        },
        reset() { record.resets += 1; },
        teardown() { record.tornDown += 1; },
        diagnostics() { return Object.freeze({ rigged: record.installed > 0 }); },
      };
    },
    createBallView() {
      const record = { renders: 0, resets: 0, tornDown: 0 };
      log.ball = record;
      return {
        render(value) {
          assert.ok(Object.isFrozen(value.ball));
          assert.ok(Object.isFrozen(value.selectedPlayer));
          record.renders += 1;
          record.value = value;
          return true;
        },
        reset() { record.resets += 1; },
        teardown() { record.tornDown += 1; },
      };
    },
  };
}

test("model adapter reconciles snapshot-only player and ball views then tears them down", () => {
  const log = { players: new Map(), ball: null };
  const views = fakeViews(log);
  let portReady = false;
  const adapter = createBrowserModelViewAdapter({
    target: { location: { search: "?visualTest=1" } },
    document: fakeDocument(),
    getScenePort: () => portReady ? { addObject() {}, removeObject() {}, copyCameraQuaternion() {}, diagnostics: () => Object.freeze({ maxAnisotropy: 1 }) } : null,
    visualTestMode: true,
    createPlayerView: views.createPlayerView,
    createBallView: views.createBallView,
    assetLoader: { load: async () => ({}) },
  });

  assert.equal(adapter.attach(), true);
  assert.equal(adapter.render(frame()), false);
  portReady = true;
  assert.equal(adapter.render(frame()), true);
  assert.equal(log.players.size, 2);
  assert.equal(log.ball.renders, 1);
  assert.equal(log.players.get("home-0").facts.selected, true);
  assert.equal(log.players.get("home-0").facts.ballOwnerId, "home-0");
  assert.equal(log.ball.value.ballStyle, "volt");
  assert.equal(log.ball.value.activeCharge.power, 0.9);
  assert.equal(adapter.diagnostics().playerCount, 2);

  assert.equal(adapter.reset(), true);
  assert.equal(log.players.get("home-0").resets, 1);
  assert.equal(log.ball.resets, 1);
  assert.equal(adapter.teardown(), true);
  assert.equal(log.players.get("home-0").tornDown, 1);
  assert.equal(log.ball.tornDown, 1);
  assert.equal(adapter.diagnostics().disposed, true);
});

test("loaded character and animations install on views without entering snapshot state", async () => {
  const log = { players: new Map(), ball: null };
  const views = fakeViews(log);
  const status = [];
  const document = fakeDocument();
  const adapter = createBrowserModelViewAdapter({
    target: { location: { search: "" }, matchMedia: () => ({ matches: false }), navigator: {} },
    document,
    getScenePort: () => ({ addObject() {}, removeObject() {}, copyCameraQuaternion() {}, diagnostics: () => Object.freeze({ maxAnisotropy: 1 }) }),
    visualTestMode: false,
    createPlayerView: views.createPlayerView,
    createBallView: views.createBallView,
    assetLoader: {
      async load({ onStatus, onCharacter, onAnimations }) {
        const loading = Object.freeze({ state: "loading", label: "MODEL · LOADING", detail: "loading" });
        status.push(loading);
        onStatus(loading);
        onCharacter({ scene: {} });
        onAnimations(Object.freeze([{ name: "Idle_Loop" }]));
        onStatus(Object.freeze({ state: "ready", label: "PLAYER RIG · READY", detail: "1 animation clips" }));
        return {};
      },
    },
  });

  adapter.attach();
  adapter.render(frame());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(log.players.get("home-0").installed, 1);
  assert.equal(log.players.get("home-0").animations, 1);
  assert.equal(adapter.diagnostics().riggedPlayers, 2);
  assert.equal(document.nodes.get("assetStatus").textContent, "PLAYER RIG · READY");
  adapter.teardown();
});

test("asset failure leaves procedural views usable and reports fallback", async () => {
  const log = { players: new Map(), ball: null };
  const views = fakeViews(log);
  const document = fakeDocument();
  const adapter = createBrowserModelViewAdapter({
    target: { location: { search: "" }, matchMedia: () => ({ matches: false }), navigator: {} },
    document,
    getScenePort: () => ({ addObject() {}, removeObject() {}, copyCameraQuaternion() {}, diagnostics: () => Object.freeze({ maxAnisotropy: 1 }) }),
    visualTestMode: false,
    createPlayerView: views.createPlayerView,
    createBallView: views.createBallView,
    assetLoader: { load: async () => { throw new Error("offline"); } },
  });
  adapter.attach();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(adapter.render(frame()), true);
  assert.equal(adapter.diagnostics().assetState, "error");
  assert.match(adapter.diagnostics().error, /offline/);
  assert.equal(document.nodes.get("assetStatus").textContent, "MODEL · FALLBACK");
  adapter.teardown();
});
