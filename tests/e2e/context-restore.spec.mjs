import { expect, test } from "./fixtures.mjs";

test("production browser factory defers context-loss fallback and restores the stable facade", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "one representative browser lifecycle integration is sufficient");
  await page.goto("/?visualTest=1&skipIntro=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);

  const result = await page.evaluate(async () => {
    const [{ createBrowserThreeSceneEnvironmentAdapter }, { createRebindableThreeSceneHostPort }, { createThreeSceneHostPort }] = await Promise.all([
      import("/src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js"),
      import("/src/game/presentation/RebindableThreeSceneHostPort.js"),
      import("/src/game/presentation/ThreeSceneHostContract.js"),
    ]);
    class FakeCanvas extends EventTarget {
      constructor() { super(); this.width = 1200; this.height = 700; this.clientWidth = 900; this.clientHeight = 525; }
    }
    const replacements = [];
    const target = new EventTarget();
    target.devicePixelRatio = 1;
    target.location = { href: `${location.origin}/?visualTest=1`, search: "?visualTest=1", replace: (url) => replacements.push(url) };
    target.navigator = { deviceMemory: 8 };
    target.matchMedia = () => ({ matches: false });
    const canvas = new FakeCanvas();
    const facade = createRebindableThreeSceneHostPort();
    const hostCalls = [];
    let generation = 0;
    const createDelegate = (name, calls) => {
      const objects = new Set();
      return createThreeSceneHostPort({
        addObject: (object) => { calls.push(["add", object.id]); objects.add(object); return true; },
        removeObject: (object) => { calls.push(["remove", object.id]); objects.delete(object); return true; },
        setCameraPose: () => { calls.push(["camera"]); return true; },
        copyCameraQuaternion: (destination) => { calls.push(["quaternion"]); destination.copy({}); return true; },
        requestRender: () => { calls.push(["render"]); return true; },
        diagnostics: () => Object.freeze({ owner: name, renderer: "webgl", profile: "browser-test", foreignObjects: objects.size }),
      });
    };
    const adapter = createBrowserThreeSceneEnvironmentAdapter({
      target,
      document: { getElementById: () => canvas },
      onHostChanged: (port) => facade.bind(port),
      contextRestoreGraceMilliseconds: 60,
      createSceneHost: () => {
        generation += 1;
        const calls = [];
        hostCalls.push(calls);
        const name = `host-${generation}`;
        return {
          port: createDelegate(name, calls),
          start: () => calls.push(["start"]),
          resize: () => calls.push(["resize"]),
          render: () => true,
          dispose: () => calls.push(["dispose"]),
        };
      },
    });
    adapter.attach();
    const runtimePort = facade.port;
    runtimePort.addObject({ id: "player" });
    runtimePort.addObject({ id: "ball" });
    runtimePort.setCameraPose(Object.freeze({ position: Object.freeze({ x: 1, y: 2, z: 3 }), lookAt: Object.freeze({ x: 4, y: 5, z: 6 }) }));
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    const immediateReplacements = replacements.length;
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    await new Promise((resolve) => setTimeout(resolve, 90));
    const quaternionTarget = { copied: false, copy() { this.copied = true; } };
    const quaternionResult = runtimePort.copyCameraQuaternion(quaternionTarget);
    const renderResult = runtimePort.requestRender();
    const diagnostics = runtimePort.diagnostics();
    const restoredOperations = hostCalls[1];
    adapter.teardown();
    return {
      liveBridgeStable: window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.().stablePort === true,
      lostPrevented: lost.defaultPrevented,
      immediateReplacements,
      finalReplacements: replacements.length,
      generation,
      restoredOperations,
      quaternionResult,
      quaternionCopied: quaternionTarget.copied,
      renderResult,
      diagnostics,
    };
  });

  expect(result.liveBridgeStable).toBe(true);
  expect(result.lostPrevented).toBe(true);
  expect(result.immediateReplacements).toBe(0);
  expect(result.finalReplacements).toBe(0);
  expect(result.generation).toBe(2);
  expect(result.restoredOperations.slice(0, 5)).toEqual([["start"], ["resize"], ["add", "player"], ["add", "ball"], ["camera"]]);
  expect(result.quaternionResult).toBe(true);
  expect(result.quaternionCopied).toBe(true);
  expect(result.renderResult).toBe(true);
  expect(result.diagnostics.bound).toBe(true);
  expect(result.diagnostics.bindGeneration).toBe(2);
  expect(result.diagnostics.retainedForeignObjects).toBe(2);
});
