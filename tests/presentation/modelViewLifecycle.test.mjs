import assert from "node:assert/strict";
import test from "node:test";

import { createBallModelView } from "../../src/game/presentation/BallModelView.js";
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
  return {
    createElement: () => ({ width: 0, height: 0, getContext: () => canvasContext() }),
  };
}

function scenePort() {
  const objects = new Set();
  return {
    objects,
    addObject(object) { objects.add(object); return true; },
    removeObject(object) { return objects.delete(object); },
    copyCameraQuaternion(target) { target.set(0, 0, 0, 1); return true; },
    diagnostics: () => Object.freeze({ maxAnisotropy: 1 }),
  };
}

const descriptor = Object.freeze({
  id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10,
  dirX: 1, dirY: 0,
});

const pose = Object.freeze({
  ...descriptor,
  x: 120, y: 300, vx: 80, vy: 0, anim: "idle", animTime: 0, animDuration: 1,
  animPower: 0, stepPhase: 1.2, sprinting: false, motionYaw: Math.PI / 2, turnLean: 0,
});
const ball = Object.freeze({ id: "match-ball", x: 150, y: 300, height: 0, angle: 0 });

test("procedural player view attaches, projects immutable facts, resets and releases its scene root", () => {
  const port = scenePort();
  const view = createPlayerModelView({
    player: descriptor,
    scenePort: port,
    document: documentStub(),
    worldX: (value) => value * 0.1,
    worldZ: (value) => value * 0.1,
    lowPowerDevice: true,
  });
  assert.equal(view.attach(), true);
  assert.equal(port.objects.size, 1);
  assert.equal(view.render({
    player: pose,
    ball,
    selectedPlayerId: "home-0",
    ballOwnerId: "home-0",
    ballOwnerTeam: 0,
    replayActive: false,
    controlMode: "attack",
    pressedCodes: Object.freeze([]),
    nowMilliseconds: 1000,
  }), true);
  assert.equal(view.root.position.x, 12);
  assert.equal(view.root.position.z, 30);
  assert.equal(view.reset(), true);
  assert.equal(view.root.position.x, 0);
  assert.equal(view.teardown(), true);
  assert.equal(port.objects.size, 0);
});

test("ball view owns surface and charge roots without mutating immutable facts", () => {
  const port = scenePort();
  const view = createBallModelView({
    scenePort: port,
    document: documentStub(),
    worldX: (value) => value * 0.1,
    worldZ: (value) => value * 0.1,
  });
  assert.equal(view.attach(), true);
  assert.equal(port.objects.size, 2);
  const charge = Object.freeze({ power: 0.9 });
  assert.equal(view.render({
    ball,
    selectedPlayer: pose,
    selectedPlayerOwnsBall: true,
    activeCharge: charge,
    ballStyle: "volt",
  }), true);
  assert.equal(view.diagnostics().style, "volt");
  assert.equal(view.diagnostics().chargeVisible, true);
  assert.equal(view.reset(), true);
  assert.equal(view.diagnostics().chargeVisible, false);
  assert.equal(view.teardown(), true);
  assert.equal(port.objects.size, 0);
});
