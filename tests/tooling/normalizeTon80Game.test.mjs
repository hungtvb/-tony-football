import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTon80GameSource } from "../../scripts/normalize-ton80-game.mjs";

const generatedWithMigrationBoundaries = `(() => {
  function createLabelSprite  function createLabelSprite(player, accent) {}
  function drawFallbackPlayerDetail  function drawFallbackPlayerDetail(player,pose,replayFrame,selectedPlayerId) {}
  function applyBallStyle() {  function applyBallStyle() {}
  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();
  window.__TONY_DEBUG__.ready = true;
}
})();
`;

const generatedWithCanonicalImports = `import { createSimulationLoop } from "./src/game/core/SimulationLoop.js";
import("./src/game/config/gameplayConfig.js");
${generatedWithMigrationBoundaries}`;

test("normalizes generated function boundaries without nesting browser bootstrap", () => {
  const normalized = normalizeTon80GameSource(generatedWithMigrationBoundaries);
  assert.doesNotMatch(normalized, /function \w+\s+function \w+/);
  assert.doesNotMatch(normalized, /\n}\n}\)\(\);\n/);
  assert.equal((normalized.match(/function applyBallStyle\(\) \{/g) ?? []).length, 1);
  assert.doesNotThrow(() => new Function(normalized));
});

test("rebases generated module imports away from the generated directory", () => {
  const normalized = normalizeTon80GameSource(generatedWithCanonicalImports);
  assert.match(normalized, /from "\.\.\/src\/game\/core\/SimulationLoop\.js"/);
  assert.match(normalized, /import\("\.\.\/src\/game\/config\/gameplayConfig\.js"\)/);
  assert.doesNotMatch(normalized, /[#']\.\/src\//);
});

test("normalization is idempotent for a prepared artifact", () => {
  const normalized = normalizeTon80GameSource(generatedWithCanonicalImports);
  assert.equal(normalizeTon80GameSource(normalized), normalized);
});

test("normalization fails closed when a required bootstrap boundary is missing", () => {
  assert.throws(
    () => normalizeTon80GameSource(generatedWithMigrationBoundaries.replace("  window.__TONY_DEBUG__.ready = true;\n", "")),
    /Missing generated TON-80 boundary/,
  );
});
