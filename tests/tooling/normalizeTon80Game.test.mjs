import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTon80GameSource } from "../../scripts/normalize-ton80-game.mjs";

const finalRuntime = `import { BrowserBootstrapComposition } from "./src/game/application/BrowserBootstrapComposition.js";
import { createBrowserPresentationFeedbackAdapter } from "./src/game/presentation/BrowserPresentationFeedbackAdapter.js";
import("./src/game/config/gameplayConfig.js");
(() => {
  const presentationPort = window.__TONY_COMPATIBILITY_PRESENTATION_PORT__;
  const browserBootstrap = new BrowserBootstrapComposition();
  createBrowserPresentationFeedbackAdapter({ target: window });
  void presentationPort;
  void browserBootstrap;
})();
`;

test("preserves the final TON-85 runtime boundary", () => {
  const normalized = normalizeTon80GameSource(finalRuntime);
  assert.match(normalized, /__TONY_COMPATIBILITY_PRESENTATION_PORT__/);
  assert.match(normalized, /new BrowserBootstrapComposition/);
  assert.match(normalized, /createBrowserPresentationFeedbackAdapter/);
  assert.doesNotThrow(() => new Function(normalized.replace(/^import .*$/gm, "")));
});

test("rebases generated static and dynamic imports", () => {
  const normalized = normalizeTon80GameSource(finalRuntime);
  assert.match(normalized, /from "\.\.\/src\/game\/application\/BrowserBootstrapComposition\.js"/);
  assert.match(normalized, /from "\.\.\/src\/game\/presentation\/BrowserPresentationFeedbackAdapter\.js"/);
  assert.match(normalized, /import\("\.\.\/src\/game\/config\/gameplayConfig\.js"\)/);
});

test("normalization is idempotent", () => {
  const normalized = normalizeTon80GameSource(finalRuntime);
  assert.equal(normalizeTon80GameSource(normalized), normalized);
});

for (const marker of ["__TONY_COMPATIBILITY_PRESENTATION_PORT__", "new BrowserBootstrapComposition", "createBrowserPresentationFeedbackAdapter"]) {
  test(`fails closed without ${marker}`, () => {
    assert.throws(() => normalizeTon80GameSource(finalRuntime.replace(marker, "")), /Missing TON-85 runtime boundary/);
  });
}

test("fails closed without the single runtime IIFE boundary", () => {
  assert.throws(() => normalizeTon80GameSource(finalRuntime.replace("\n})();\n", "\n}\n")), /Expected one runtime IIFE closing boundary/);
});
