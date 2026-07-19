import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("browser entry cannot restore compatibility gameplay authority", async () => {
  const [index, entry, runtime, application, smoke] = await Promise.all([
    read("index.html"),
    read("browser-entry.js"),
    read("src/game/application/BrowserRuntimeComposition.js"),
    read("src/game/application/ApplicationRuntime.js"),
    read("tests/e2e/smoke.spec.mjs"),
  ]);

  assert.match(index, /src="browser-entry\.js\?v=/);
  assert.doesNotMatch(index, /src="game\.js\?v=/);
  assert.match(entry, /"runtime"/);
  assert.match(entry, /"debugScenario"/);
  assert.match(entry, /removeBrowserGameplayDebugMutators/);
  assert.match(entry, /delete debug\.applyScenario/);
  assert.match(entry, /createRebindableThreeSceneHostPort/);
  assert.match(entry, /getPort: \(\) => sceneFacade\.bound \? sceneFacade\.port : null/);
  assert.match(entry, /onHostChanged: \(port\) => sceneFacade\.bind\(port\)/);
  assert.match(entry, /await import\("\.\/generated\/game\.js\?v=/);
  assert.doesNotMatch(entry, /await import\("\.\/game\.js\?v=/);
  assert.doesNotMatch(runtime, /params\.get\("runtime"\)/);
  assert.doesNotMatch(runtime, /params\.has\("debugScenario"\)/);
  assert.match(application, /require live engine authority/);
  assert.doesNotMatch(application, /dispatchGameCommand/);
  assert.match(smoke, /runtime=compatibility&debugScenario=low-stamina/);
  assert.match(smoke, /hasApplyScenario/);
  assert.match(smoke, /runtimeMode\)\.toBe\("engine"\)/);
});
