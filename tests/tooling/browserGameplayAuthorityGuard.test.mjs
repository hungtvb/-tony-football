import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("browser entry cannot restore compatibility gameplay authority", async () => {
  const [index, entry, runtime, smoke] = await Promise.all([
    read("index.html"),
    read("browser-entry.js"),
    read("src/game/application/BrowserRuntimeComposition.js"),
    read("tests/e2e/smoke.spec.mjs"),
  ]);

  assert.match(index, /src="browser-entry\.js\?v=/);
  assert.doesNotMatch(index, /src="game\.js\?v=/);
  assert.match(entry, /"runtime"/);
  assert.match(entry, /"debugScenario"/);
  assert.match(entry, /await import\("\.\/game\.js\?v=/);
  assert.doesNotMatch(runtime, /params\.get\("runtime"\)/);
  assert.doesNotMatch(runtime, /params\.has\("debugScenario"\)/);
  assert.doesNotMatch(smoke, /debugScenario=/);
  assert.match(smoke, /runtimeMode\)\.toBe\("engine"\)/);
});