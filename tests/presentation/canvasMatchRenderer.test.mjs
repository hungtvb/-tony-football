import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createCanvasMatchRenderer } from "../../src/game/presentation/CanvasMatchRenderer.js";

function createTarget(search = "?renderer=canvas") {
  const listeners = new Map();
  return {
    location: { search }, devicePixelRatio: 2,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); },
    listeners,
  };
}

function createContext() {
  const calls = [];
  const context = {
    calls,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineCap: "", font: "", textAlign: "", textBaseline: "", globalAlpha: 1,
    save() { calls.push(["save"]); }, restore() { calls.push(["restore"]); }, setTransform(...args) { calls.push(["setTransform", ...args]); },
    clearRect(...args) { calls.push(["clearRect", ...args]); }, fillRect(...args) { calls.push(["fillRect", ...args]); }, strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    beginPath() { calls.push(["beginPath"]); }, moveTo(...args) { calls.push(["moveTo", ...args]); }, lineTo(...args) { calls.push(["lineTo", ...args]); },
    arc(...args) { calls.push(["arc", ...args]); }, ellipse(...args) { calls.push(["ellipse", ...args]); }, stroke() { calls.push(["stroke"]); }, fill() { calls.push(["fill"]); },
    translate(...args) { calls.push(["translate", ...args]); }, rotate(...args) { calls.push(["rotate", ...args]); }, roundRect(...args) { calls.push(["roundRect", ...args]); },
    fillText(...args) { calls.push(["fillText", ...args]); },
  };
  return context;
}

function createDocument({ context = createContext(), includeCanvas = true } = {}) {
  const canvas = includeCanvas ? { width: 1200, height: 700, clientWidth: 900, clientHeight: 525, getContext: () => context } : null;
  return { canvas, context, getElementById: (id) => id === "gameCanvas" ? canvas : null };
}

function snapshot({ tick, selectedX, ballX, weather = "clear", goalSequence = null } = {}) {
  return createMatchSnapshot({
    tick,
    match: {
      state: "playing", time: 120, matchSeconds: 150, elapsed: 30, score: [1, 0], stats: { possession: [55, 45], shots: [2, 1], passes: 5, completed: 4 },
      selectedPlayerId: "home-0", settings: { pitchStyle: "elite", ballStyle: "volt", weather }, controls: { lastMode: "attack" }, replay: { active: false }, goalSequence,
    },
    players: [
      { id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, x: selectedX, y: 300, vx: 40, vy: 0, dirX: 1, dirY: 0, radius: 17, stepPhase: 1 },
      { id: "away-0", team: 1, index: 0, role: "GK", name: "NOVA", number: 1, x: 1040, y: 350, vx: 0, vy: 0, dirX: -1, dirY: 0, radius: 20, stepPhase: 0 },
    ],
    ball: { id: "match-ball", ownerId: "home-0", x: ballX, y: 305, vx: 20, vy: 0, height: 1, radius: 9, angle: .2, spin: .1 },
  });
}

function frame(previous, current) {
  return Object.freeze({ previousSnapshot: previous, snapshot: current, alpha: .5, nowMilliseconds: 1000, controlMode: "attack", activeCharge: Object.freeze({ code: "KeyD", power: .75 }), pressedCodes: Object.freeze(["KeyD"]) });
}

test("Canvas renderer stays inactive outside an explicit Canvas session", () => {
  const target = createTarget("?visualTest=1"); const document = createDocument();
  const renderer = createCanvasMatchRenderer({ target, document });
  assert.equal(renderer.attach(), false); assert.equal(renderer.active, false); assert.equal(renderer.status, "inactive");
  assert.equal(renderer.render(frame(snapshot({ tick: 1, selectedX: 100, ballX: 120 }), snapshot({ tick: 2, selectedX: 120, ballX: 140 }))), false);
  assert.equal(renderer.teardown(), true);
});

test("Canvas renderer reports missing canvas and missing 2D context without throwing", () => {
  const missingCanvas = createCanvasMatchRenderer({ target: createTarget(), document: createDocument({ includeCanvas: false }) });
  assert.equal(missingCanvas.attach(), false); assert.equal(missingCanvas.status, "canvas-missing"); assert.equal(missingCanvas.teardown(), true);
  const noContextDocument = createDocument({ context: null });
  const missingContext = createCanvasMatchRenderer({ target: createTarget(), document: noContextDocument });
  assert.equal(missingContext.attach(), false); assert.equal(missingContext.status, "context-missing"); assert.equal(missingContext.teardown(), true);
});

test("Canvas renderer projects interpolated immutable match facts and explicit lifecycle", () => {
  const target = createTarget(); const document = createDocument();
  const renderer = createCanvasMatchRenderer({ target, document });
  assert.equal(renderer.attach(), true); assert.equal(renderer.active, true); assert.equal(target.listeners.has("resize"), true);
  const previous = snapshot({ tick: 1, selectedX: 100, ballX: 120 });
  const current = snapshot({ tick: 2, selectedX: 140, ballX: 160, weather: "rain", goalSequence: { team: 0, timer: 1, duration: 2 } });
  assert.equal(renderer.render(frame(previous, current)), true);
  const diagnostics = renderer.diagnostics();
  assert.equal(diagnostics.owner, "canvas-match-renderer"); assert.equal(diagnostics.renderCount, 1); assert.equal(diagnostics.status, "ready");
  assert.deepEqual(diagnostics.lastFacts.score, [1, 0]); assert.equal(diagnostics.lastFacts.time, 120); assert.equal(diagnostics.lastFacts.selectedPlayerId, "home-0"); assert.equal(diagnostics.lastFacts.ballOwnerId, "home-0");
  assert.equal(diagnostics.lastFacts.selectedX, 120); assert.equal(diagnostics.lastFacts.ballX, 140);
  assert.equal(document.context.calls.some((call) => call[0] === "setTransform" && call[1] === 1), true);
  assert.equal(document.context.calls.some((call) => call[0] === "fillText" && call[1] === "GOAL!"), true);
  assert.equal(renderer.resize(), true); assert.equal(renderer.diagnostics().viewport.cssWidth, 900);
  assert.equal(renderer.reset(), true); assert.equal(renderer.diagnostics().renderCount, 0); assert.equal(renderer.diagnostics().lastFacts, null);
  assert.equal(renderer.teardown(), true); assert.equal(renderer.status, "disposed"); assert.equal(target.listeners.has("resize"), false); assert.equal(renderer.teardown(), false);
});

test("Canvas renderer rejects mutable presentation frames", () => {
  const renderer = createCanvasMatchRenderer({ target: createTarget(), document: createDocument() }); renderer.attach();
  const current = snapshot({ tick: 1, selectedX: 100, ballX: 120 });
  assert.throws(() => renderer.render({ previousSnapshot: current, snapshot: current, alpha: 0, nowMilliseconds: 0 }), /immutable frame/);
  renderer.teardown();
});
