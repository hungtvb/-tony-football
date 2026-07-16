import assert from "node:assert/strict";
import test from "node:test";

import { GameCommandType } from "../../src/game/engine/GameCommands.js";
import { BrowserInputAdapter } from "../../src/game/input/BrowserInputAdapter.js";
import { FO4_CONTROLS, movementFromPressedCodes } from "../../src/game/input/FO4Controls.js";

class FakeEventTarget {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  dispatch(type, init = {}) {
    const event = {
      code: "",
      repeat: false,
      shiftKey: false,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...init
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
}

function createHarness({ mode = "attack", state = "playing" } = {}) {
  const target = new FakeEventTarget();
  const commands = [];
  const applicationRequests = [];
  let now = 100;
  let cameraCycles = 0;
  const adapter = new BrowserInputAdapter({
    target,
    clock: () => now,
    onCommand: (command) => commands.push(command),
    onApplicationRequest: (request) => applicationRequests.push(request),
    onCameraCycle: () => { cameraCycles += 1; },
    getControlMode: () => mode,
    getMatchState: () => state
  });
  adapter.attach();
  return {
    target,
    adapter,
    commands,
    applicationRequests,
    setNow(value) { now = value; },
    cameraCycles: () => cameraCycles
  };
}

test("FO4 mapping preserves normalized arrow movement", () => {
  assert.equal(FO4_CONTROLS.shortPass, "KeyS");
  assert.equal(FO4_CONTROLS.throughBall, "KeyW");
  assert.equal(FO4_CONTROLS.shoot, "KeyD");
  assert.equal(FO4_CONTROLS.sprint, "KeyE");
  const movement = movementFromPressedCodes(new Set(["ArrowRight", "ArrowUp"]));
  assert.ok(Math.abs(Math.hypot(movement.x, movement.y) - 1) < 1e-12);
  assert.ok(Object.isFrozen(movement));
});

test("arrow state emits immutable movement commands on press and release", () => {
  const harness = createHarness();
  const down = harness.target.dispatch("keydown", { code: "ArrowRight" });
  harness.target.dispatch("keydown", { code: "ArrowUp" });
  harness.target.dispatch("keyup", { code: "ArrowRight" });

  assert.equal(down.defaultPrevented, true);
  assert.deepEqual(harness.commands.map((command) => command.type), [
    GameCommandType.MOVE,
    GameCommandType.MOVE,
    GameCommandType.MOVE
  ]);
  assert.deepEqual(harness.commands.at(-1).payload, { x: 0, y: -1 });
  assert.ok(harness.commands.every(Object.isFrozen));
});

test("charged attack releases one FO4 kick command with captured modifiers", () => {
  const harness = createHarness();
  harness.target.dispatch("keydown", { code: FO4_CONTROLS.teammateRun });
  harness.target.dispatch("keydown", { code: FO4_CONTROLS.shoot });
  harness.setNow(550);
  harness.target.dispatch("keyup", { code: FO4_CONTROLS.shoot });
  harness.target.dispatch("keyup", { code: FO4_CONTROLS.teammateRun });

  const shot = harness.commands.find((command) => command.type === GameCommandType.SHOOT);
  assert.deepEqual(harness.commands.map((command) => command.type), [
    GameCommandType.SET_ATTACK_INTENT,
    GameCommandType.SET_ATTACK_INTENT,
    GameCommandType.SHOOT
  ]);
  assert.deepEqual(harness.commands.slice(0, 2).map((command) => command.payload.active), [true, false]);
  assert.equal(shot.payload.power, 0.5);
  assert.deepEqual(shot.payload.direction, { x: 1, y: 0 });
  assert.deepEqual(shot.payload.modifiers, { chip: true, finesse: false });
  assert.equal(harness.commands.some((command) => command.type === GameCommandType.TRIGGER_TEAMMATE_RUN), false);
});

test("defense maps S A Space W and Q without changing the FO4 keys", () => {
  const harness = createHarness({ mode: "defense" });
  for (const code of [
    FO4_CONTROLS.shortPass,
    FO4_CONTROLS.loftPass,
    FO4_CONTROLS.tackle,
    FO4_CONTROLS.throughBall,
    FO4_CONTROLS.teammateRun
  ]) harness.target.dispatch("keydown", { code });
  harness.target.dispatch("keyup", { code: FO4_CONTROLS.throughBall });
  harness.target.dispatch("keyup", { code: FO4_CONTROLS.teammateRun });

  assert.deepEqual(harness.commands.map((command) => command.type), [
    GameCommandType.SWITCH_PLAYER,
    GameCommandType.SLIDE_TACKLE,
    GameCommandType.TACKLE,
    GameCommandType.SET_GOALKEEPER_RUSH,
    GameCommandType.SET_TEAM_PRESS,
    GameCommandType.SET_GOALKEEPER_RUSH,
    GameCommandType.SET_TEAM_PRESS
  ]);
  assert.equal(harness.commands.at(-2).payload.active, false);
  assert.equal(harness.commands.at(-1).payload.active, false);
});

test("blur releases held state and requests pause only during play", () => {
  const harness = createHarness();
  harness.target.dispatch("keydown", { code: FO4_CONTROLS.sprint });
  harness.target.dispatch("keydown", { code: FO4_CONTROLS.shield });
  harness.target.dispatch("blur");

  assert.deepEqual(harness.commands.slice(-3).map((command) => [command.type, command.payload]), [
    [GameCommandType.MOVE, { x: 0, y: 0 }],
    [GameCommandType.SET_SPRINT, { active: false }],
    [GameCommandType.SET_SHIELD, { active: false }]
  ]);
  assert.deepEqual(harness.applicationRequests, ["match:pause"]);
  assert.deepEqual(harness.adapter.pressedCodes, []);
});
