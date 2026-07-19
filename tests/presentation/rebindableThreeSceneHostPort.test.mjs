import assert from "node:assert/strict";
import test from "node:test";

import { createRebindableThreeSceneHostPort } from "../../src/game/presentation/RebindableThreeSceneHostPort.js";
import {
  ThreeSceneEnvironmentStatus,
  createThreeSceneEnvironmentAdapter,
} from "../../src/game/presentation/ThreeSceneEnvironmentAdapter.js";
import { createThreeSceneHostPort } from "../../src/game/presentation/ThreeSceneHostContract.js";

function createDelegate(name, calls, { rejectObject = null, rejectCamera = false } = {}) {
  const objects = new Set();
  return createThreeSceneHostPort({
    addObject: (object) => {
      calls.push([name, "add", object]);
      if (object === rejectObject) return false;
      objects.add(object);
      return true;
    },
    removeObject: (object) => {
      calls.push([name, "remove", object]);
      objects.delete(object);
      return true;
    },
    setCameraPose: (pose) => {
      calls.push([name, "camera", pose]);
      return !rejectCamera;
    },
    copyCameraQuaternion: (target) => {
      calls.push([name, "quaternion", target]);
      return true;
    },
    requestRender: () => {
      calls.push([name, "render"]);
      return true;
    },
    diagnostics: () => Object.freeze({
      owner: name,
      renderer: "webgl",
      profile: "test-profile",
      foreignObjects: objects.size,
    }),
  });
}

const pose = Object.freeze({
  position: Object.freeze({ x: 1, y: 2, z: 3 }),
  lookAt: Object.freeze({ x: 4, y: 5, z: 6 }),
});

test("stable port replays retained objects and camera pose to a fresh host", () => {
  const calls = [];
  const facade = createRebindableThreeSceneHostPort();
  const first = createDelegate("first", calls);
  const second = createDelegate("second", calls);
  const player = { id: "player" };
  const ball = { id: "ball" };

  assert.equal(facade.bind(first), true);
  const stablePort = facade.port;
  assert.equal(stablePort.addObject(player), true);
  assert.equal(stablePort.addObject(ball), true);
  assert.equal(stablePort.setCameraPose(pose), true);
  assert.equal(facade.bind(null), true);
  assert.equal(facade.bound, false);
  assert.equal(facade.bind(second), true);
  assert.equal(facade.port, stablePort);
  assert.equal(facade.generation, 2);

  const secondCalls = calls.filter(([name]) => name === "second");
  assert.deepEqual(secondCalls.map(([, operation]) => operation), ["add", "add", "camera"]);
  assert.equal(stablePort.copyCameraQuaternion({ copy() {} }), true);
  assert.equal(stablePort.requestRender(), true);
  assert.equal(stablePort.diagnostics().retainedForeignObjects, 2);
});

test("detached registrations are retained while removals are not replayed", () => {
  const calls = [];
  const facade = createRebindableThreeSceneHostPort();
  const player = { id: "player" };
  const ball = { id: "ball" };

  assert.equal(facade.port.addObject(player), true);
  assert.equal(facade.port.addObject(ball), true);
  assert.equal(facade.port.removeObject(player), true);
  assert.equal(facade.bind(createDelegate("fresh", calls)), true);
  assert.deepEqual(calls.map(([, operation, object]) => [operation, object?.id]), [["add", "ball"]]);
});

test("failed rebind rolls back registrations without disposing foreign resources", () => {
  const calls = [];
  let disposed = 0;
  const facade = createRebindableThreeSceneHostPort();
  const player = { id: "player", geometry: { dispose: () => { disposed += 1; } } };
  const ball = { id: "ball", material: { dispose: () => { disposed += 1; } } };

  facade.port.addObject(player);
  facade.port.addObject(ball);
  facade.port.setCameraPose(pose);

  assert.throws(
    () => facade.bind(createDelegate("bad", calls, { rejectObject: ball })),
    /rejected retained object/,
  );
  assert.equal(facade.bound, false);
  assert.equal(disposed, 0);
  assert.deepEqual(calls.map(([, operation, object]) => [operation, object?.id]), [
    ["add", "player"],
    ["add", "ball"],
    ["remove", "player"],
  ]);

  calls.length = 0;
  assert.equal(facade.bind(createDelegate("good", calls)), true);
  assert.deepEqual(calls.map(([, operation]) => operation), ["add", "add", "camera"]);
});

class FakeCanvas extends EventTarget {
  constructor() {
    super();
    this.width = 1200;
    this.height = 700;
    this.clientWidth = 900;
    this.clientHeight = 525;
  }
}

test("adapter context restoration rebinds the stable port and reattaches live views", () => {
  const target = new EventTarget();
  target.devicePixelRatio = 2;
  target.location = { search: "" };
  const canvas = new FakeCanvas();
  const document = { getElementById: () => canvas };
  const facade = createRebindableThreeSceneHostPort();
  const hostCalls = [];
  let generation = 0;

  const adapter = createThreeSceneEnvironmentAdapter({
    target,
    document,
    onHostChanged: (port) => facade.bind(port),
    createSceneHost: () => {
      generation += 1;
      const name = `host-${generation}`;
      const calls = [];
      hostCalls.push(calls);
      return {
        port: createDelegate(name, calls),
        start: () => calls.push([name, "start"]),
        resize: () => calls.push([name, "resize"]),
        render: () => {
          calls.push([name, "host-render"]);
          return true;
        },
        dispose: () => calls.push([name, "dispose"]),
      };
    },
  });

  assert.equal(adapter.attach(), true);
  const runtimePort = facade.port;
  const player = { id: "player" };
  const ball = { id: "ball" };
  assert.equal(runtimePort.addObject(player), true);
  assert.equal(runtimePort.addObject(ball), true);
  assert.equal(runtimePort.setCameraPose(pose), true);

  const lost = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented, true);
  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.FALLBACK);
  assert.equal(facade.bound, false);
  assert.equal(runtimePort, facade.port);

  const trail = { id: "trail" };
  assert.equal(runtimePort.addObject(trail), true);
  canvas.dispatchEvent(new Event("webglcontextrestored"));

  assert.equal(adapter.status, ThreeSceneEnvironmentStatus.WEBGL);
  assert.equal(facade.bound, true);
  assert.equal(generation, 2);
  const restoredOperations = hostCalls[1].map(([, operation, object]) => [operation, object?.id]);
  assert.deepEqual(restoredOperations.slice(0, 5), [
    ["start", undefined],
    ["resize", undefined],
    ["add", "player"],
    ["add", "ball"],
    ["add", "trail"],
  ]);
  assert.equal(restoredOperations[5][0], "camera");

  assert.equal(runtimePort.copyCameraQuaternion({ copy() {} }), true);
  assert.equal(runtimePort.requestRender(), true);
  assert.equal(adapter.render(Object.freeze({ tick: 1 })), true);
  assert.equal(hostCalls[1].some(([, operation]) => operation === "quaternion"), true);
  assert.equal(hostCalls[1].some(([, operation]) => operation === "render"), true);
  assert.equal(hostCalls[1].some(([, operation]) => operation === "host-render"), true);
  adapter.teardown();
});
