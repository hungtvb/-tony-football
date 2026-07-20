import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTon80GameSource } from "../../scripts/normalize-ton80-game.mjs";

const prepared = `import { createSimulationLoop } from "./src/game/core/SimulationLoop.js";
import("./src/game/config/gameplayConfig.js");
(() => {
  let threeScenePort = null;
  function applyBallStyle() { return true; }
  function createParticleView() {}
  function drawFallbackPlayerDetail(player,pose,replayFrame,selectedPlayerId) {}
  const browserBootstrap = { start() {} };
  const init3D = () => {};
  const createTeams = () => {};
  const updateUI = () => {};
  const captureCompatibilitySnapshot = () => {};
  window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.();
  window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.();
  const options = {
    onPresentationReady: init3D,
  };
  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();
  window.__TONY_DEBUG__.ready = true;
})();
`;

test("normalization rebases generated imports and is idempotent", () => {
  const normalized = normalizeTon80GameSource(prepared);
  assert.match(normalized, /from "\.\.\/src\/game\/core\/SimulationLoop\.js"/);
  assert.match(normalized, /import\("\.\.\/src\/game\/config\/gameplayConfig\.js"\)/);
  assert.equal(normalizeTon80GameSource(normalized), normalized);
});

test("normalization fails closed if model ownership returns", () => {
  assert.throws(
    () => normalizeTon80GameSource(prepared.replace("  function createParticleView() {}", "  function createParticleView() {}\n  new THREE.AnimationMixer(model);")),
    /retains TON-81 ownership/,
  );
});

test("normalization fails closed when a required boundary is missing", () => {
  assert.throws(
    () => normalizeTon80GameSource(prepared.replace("  window.__TONY_DEBUG__.ready = true;\n", "")),
    /Missing generated presentation boundary/,
  );
});
