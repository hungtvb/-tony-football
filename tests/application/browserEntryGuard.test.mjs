import assert from "node:assert/strict";
import test from "node:test";

import {
  removeBrowserGameplayDebugMutators,
  sanitizeBrowserRuntimeSearch,
} from "../../browser-entry.js";

test("browser entry removes compatibility and gameplay-mutation query seams", () => {
  assert.deepEqual(sanitizeBrowserRuntimeSearch(""), {
    changed: false,
    search: "",
  });
  assert.deepEqual(sanitizeBrowserRuntimeSearch("?runtime=compatibility"), {
    changed: true,
    search: "",
  });
  assert.deepEqual(sanitizeBrowserRuntimeSearch("?debugScenario=low-stamina&renderer=canvas&visualTest=1"), {
    changed: true,
    search: "?renderer=canvas&visualTest=1",
  });
  assert.deepEqual(sanitizeBrowserRuntimeSearch("?runtime=engine&goalTest=1&skipIntro=1"), {
    changed: true,
    search: "?goalTest=1&skipIntro=1",
  });
});

test("browser entry removes the public legacy gameplay mutation API", () => {
  const applyScenario = () => {};
  const diagnostics = () => ({ ready: true });
  const debug = { applyScenario, diagnostics };

  assert.equal(removeBrowserGameplayDebugMutators(debug), true);
  assert.equal("applyScenario" in debug, false);
  assert.equal(debug.diagnostics, diagnostics);
  assert.equal(removeBrowserGameplayDebugMutators(debug), false);
  assert.equal(removeBrowserGameplayDebugMutators(null), false);
});