import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createBrowserThreeSceneEnvironmentAdapter } from "../../src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js";
import { createRebindableThreeSceneHostPort } from "../../src/game/presentation/RebindableThreeSceneHostPort.js";
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

function createTarget(replacements) {
  const target = new EventTarget();
  target.devicePixelRatio = 1;
  target.location = {
    href: "https://example.test/?visualTest=1",
    search: "?visualTest=1",
    replace: (url) => replacements.push(url),
  };
  target.navigator = { deviceMemory: 8 };
  target.matchMedia = () => ({ matches: false });
  return target;
}

function createDelegate(name, calls) {
  const objects = new Set();
  return createThreeSceneHostPort({
    addObject: (object) => {
      calls.push([name, "add", object]);
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
      return true;
    },
    copyCameraQuaternion: (target) => {
      calls.push([name, "quaternion", target]);
      target.copy?.({});
      return true;
    },
    requestRender: () => {
      calls.push([name, "render"]);
      return true;
    },
    diagnostics: () => Object.freeze({
      owner: name,
      renderer: "webgl",
      profile: "test",
      foreignObjects: objects.size,
    }),
  });
}

const pose = Object.freeze({
  position: Object.freeze({ x: 1, y: 2, z: 3 }),
  lookAt: Object.freeze({ x: 4, y: 5, z: 6 }),
});

test("production factory keeps context loss on-page and restores the stable facade once", () => {
  const replacements = [];
  const target = createTarget(replacements);
  const canvas = new FakeCanvas();
  const facade = createRebindableThreeSceneHostPort();
  const hostCalls = [];
  let generation = 0;
  const adapter = createBrowserThreeSceneEnvironmentAdapter({
    target,
    document: { getElementById: () => canvas },
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
        render: () => true,
        dispose: () => calls.push([name, "dispose"]),
      };
    },
  });

  assert.equal(adapter.attach(), true);
  const runtimePort = facade.port;
  const player = { id: "player" };
  const ball = { id: "ball" };
  runtimePort.addObject(player);
  runtimePort.addObject(ball);
  runtimePort.setCameraPose(pose);

  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  assert.equal(replacements.length, 0);
  assert.equal(facade.bound, false);

  canvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.equal(generation, 2);
  assert.equal(facade.bound, true);
  assert.equal(replacements.length, 0);

  const restoredOperations = hostCalls[1].map(([, operation, object]) => [operation, object?.id]);
  assert.deepEqual(restoredOperations.slice(0, 5), [
    ["start", undefined],
    ["resize", undefined],
    ["add", "player"],
    ["add", "ball"],
    ["camera", undefined],
  ]);
  assert.equal(runtimePort.copyCameraQuaternion({ copy() {} }), true);
  assert.equal(runtimePort.requestRender(), true);
  adapter.teardown();
});

test("startup failure and failed one-shot restoration route to Canvas immediately", () => {
  const initialReplacements = [];
  const initialTarget = createTarget(initialReplacements);
  const initialCanvas = new FakeCanvas();
  const initialFailure = createBrowserThreeSceneEnvironmentAdapter({
    target: initialTarget,
    document: { getElementById: () => initialCanvas },
    createSceneHost: () => ({
      start() { throw new Error("initial startup failed"); },
      resize() {},
      render() {},
      dispose() {},
    }),
  });
  assert.equal(initialFailure.attach(), false);
  assert.equal(initialReplacements.length, 1);
  assert.match(initialReplacements[0], /renderer=canvas/);
  initialFailure.teardown();

  const restoreReplacements = [];
  const restoreTarget = createTarget(restoreReplacements);
  const restoreCanvas = new FakeCanvas();
  let generation = 0;
  const restoreFailure = createBrowserThreeSceneEnvironmentAdapter({
    target: restoreTarget,
    document: { getElementById: () => restoreCanvas },
    createSceneHost: () => {
      generation += 1;
      if (generation === 2) {
        return {
          start() { throw new Error("restored host failed"); },
          resize() {},
          render() {},
          dispose() {},
        };
      }
      return {
        port: createDelegate("initial-host", []),
        start() {},
        resize() {},
        render() { return true; },
        dispose() {},
      };
    },
  });

  assert.equal(restoreFailure.attach(), true);
  restoreCanvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  assert.equal(restoreReplacements.length, 0);
  restoreCanvas.dispatchEvent(new Event("webglcontextrestored"));
  assert.equal(generation, 2);
  assert.equal(restoreReplacements.length, 1);
  assert.match(restoreReplacements[0], /renderer=canvas/);
  restoreFailure.teardown();
});

test("production fallback factory contains no timer or retry orchestration", async () => {
  const source = await readFile(
    new URL("../../src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /setTimeout|clearTimeout|restoreGrace|GraceMilliseconds|scheduleTimeout|cancelTimeout/);
});
