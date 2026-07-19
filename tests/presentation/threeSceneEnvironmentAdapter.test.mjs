import assert from "node:assert/strict";
import test from "node:test";

import {
  THREE_SCENE_FALLBACK_EVENT,
  ThreeSceneEnvironmentStatus,
  createThreeSceneEnvironmentAdapter,
} from "../../src/game/presentation/ThreeSceneEnvironmentAdapter.js";
import { createThreeSceneHostPort } from "../../src/game/presentation/ThreeSceneHostContract.js";

class FakeCanvas extends EventTarget {
  constructor() {
    super();
    this.width = 1200;
    this.height = 700;
    this.clientWidth = 900;
    this.clientHeight = 525;
  }
}

function createHarness({ preference = null, createSceneHost } = {}) {
  const target = new EventTarget();
  target.devicePixelRatio = 2;
  target.location = { search: preference ? `?renderer=${preference}` : "" };
  const canvas = new FakeCanvas();
  const document = { getElementById: (id) => id === "gameCanvas" ? canvas : null };
  const fallback = [];
  target.addEventListener(THREE_SCENE_FALLBACK_EVENT, (event) => fallback.push(event.detail));
  const hostChanges = [];
  const adapter = createThreeSceneEnvironmentAdapter({
    target,
    document,
    createSceneHost,
    onHostChanged: (port) => hostChanges.push(port),
  });
  return { adapter, canvas, target, fallback, hostChanges };
}

function createHost(calls, overrides = {}) {
  const port = Object.freeze({ kind: "scene-host-port" });
  return {
    port,
    start: () => calls.push("start"),
    resize: (viewport) => calls.push(["resize", viewport]),
    render: (frame) => {
      calls.push(["render", frame.tick]);
      return true;
    },
    reset: () => calls.push("reset"),
    dispose: () => calls.push("dispose"),
    ...overrides,
  };
}

test("scene adapter owns successful lifecycle, resize and immutable host port", () => {
  const calls = [];
  const { adapter, target, hostChanges } = createHarness({
    createSceneHost: () => createHost(calls),
  });

  assert.equal(adapter.attach(), true);
  assert.equal(adapter.attach(), false);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.WEBGL);
  assert.equal(Object.isFrozen(adapter.port), true);
  assert.deepEqual(hostChanges, [adapter.port]);

  assert.equal(adapter.render(Object.freeze({ tick: 4 })), true);
  target.dispatchEvent(new Event("resize"));
  assert.equal(adapter.reset(Object.freeze({ reason: "restart" })), true);
  assert.equal(adapter.teardown(), true);
  assert.equal(adapter.teardown(), false);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.IDLE);
  assert.equal(adapter.port, null);
  assert.deepEqual(hostChanges.at(-1), null);
  assert.deepEqual(calls.map((entry) => Array.isArray(entry) ? entry[0] : entry), [
    "start", "resize", "render", "resize", "reset", "dispose",
  ]);
});

test("forced Canvas and missing canvas publish explicit fallback without creating a host", () => {
  let created = 0;
  const forced = createHarness({
    preference: "canvas",
    createSceneHost: () => {
      created += 1;
      return createHost([]);
    },
  });
  assert.equal(forced.adapter.attach(), false);
  assert.equal(forced.adapter.status, ThreeSceneEnvironmentStatus.FALLBACK);
  assert.equal(forced.fallback[0].reason, "forced-canvas");
  assert.equal(created, 0);
  forced.adapter.teardown();

  const target = new EventTarget();
  const adapter = createThreeSceneEnvironmentAdapter({
    target,
    document: { getElementById: () => null },
    createSceneHost: () => {
      created += 1;
      return createHost([]);
    },
  });
  assert.equal(adapter.attach(), false);
  assert.equal(adapter.fallback.reason, "canvas-missing");
  adapter.teardown();
  assert.equal(created, 0);
});

test("partial startup failure rolls back host and remains restartable", () => {
  const calls = [];
  let attempts = 0;
  const { adapter } = createHarness({
    createSceneHost: () => {
      attempts += 1;
      return createHost(calls, {
        start: () => {
          calls.push("start");
          if (attempts === 1) throw new Error("startup failed");
        },
      });
    },
  });

  assert.equal(adapter.attach(), false);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.FALLBACK);
  assert.deepEqual(calls, ["start", "dispose"]);
  adapter.teardown();

  assert.equal(adapter.attach(), true);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.WEBGL);
  adapter.teardown();
});

test("context loss disposes the host and context restore recreates it", () => {
  const calls = [];
  let generation = 0;
  const { adapter, canvas, fallback } = createHarness({
    createSceneHost: () => {
      generation += 1;
      return createHost(calls);
    },
  });
  adapter.attach();

  const lost = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented, true);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.FALLBACK);
  assert.equal(fallback.at(-1).reason, "webgl-context-lost");

  canvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.WEBGL);
  assert.equal(generation, 2);
  adapter.teardown();
});

test("render failure selects fallback and teardown still removes every listener", () => {
  const calls = [];
  const { adapter, target, canvas, fallback } = createHarness({
    createSceneHost: () => createHost(calls, {
      render: () => {
        calls.push("render");
        throw new Error("context operation failed");
      },
    }),
  });
  adapter.attach();
  assert.equal(adapter.render(Object.freeze({ tick: 1 })), false);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.FALLBACK);
  assert.equal(fallback.at(-1).reason, "webgl-render-failed");
  assert.equal(calls.includes("dispose"), true);
  adapter.teardown();

  const before = calls.length;
  target.dispatchEvent(new Event("resize"));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.equal(calls.length, before);
});

test("throwing disposer clears state and reports cleanup failure", () => {
  const { adapter } = createHarness({
    createSceneHost: () => createHost([], {
      dispose: () => {
        throw new Error("dispose failed");
      },
    }),
  });
  adapter.attach();
  assert.throws(() => adapter.teardown(), /dispose failed/);
  assert.equal(adapter.attached, false);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.IDLE);
  assert.equal(adapter.port, null);
});

test("scene host port exposes explicit operations without raw mutable handles", () => {
  const calls = [];
  const port = createThreeSceneHostPort({
    addObject: (object) => calls.push(["add", object]),
    removeObject: (object) => calls.push(["remove", object]),
    setCameraPose: (pose) => calls.push(["camera", pose]),
    copyCameraQuaternion: (target) => calls.push(["quaternion", target]),
    requestRender: () => calls.push(["render"]),
    diagnostics: () => Object.freeze({ renderer: "webgl" }),
  });

  const object = {};
  const quaternion = {};
  const pose = Object.freeze({
    position: Object.freeze({ x: 0, y: 45, z: 52 }),
    lookAt: Object.freeze({ x: 0, y: 0, z: 0 }),
  });

  port.addObject(object);
  port.removeObject(object);
  port.setCameraPose(pose);
  port.copyCameraQuaternion(quaternion);
  port.requestRender();

  assert.equal(Object.isFrozen(port), true);
  assert.deepEqual(port.diagnostics(), { renderer: "webgl" });
  assert.deepEqual(calls.map(([name]) => name), ["add", "remove", "camera", "quaternion", "render"]);
  assert.equal("scene" in port, false);
  assert.equal("camera" in port, false);
  assert.equal("renderer" in port, false);
});

test("scene host port rejects mutable camera poses and mutable diagnostics", () => {
  const port = createThreeSceneHostPort({
    addObject: () => {},
    removeObject: () => {},
    setCameraPose: () => {},
    copyCameraQuaternion: () => {},
    requestRender: () => {},
    diagnostics: () => ({}),
  });
  assert.throws(() => port.setCameraPose({ position: {} }), /immutable/);
  assert.throws(() => port.diagnostics(), /immutable/);
});
