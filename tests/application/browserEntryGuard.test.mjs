import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeBrowserRuntimeSearch } from "../../browser-entry.js";

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