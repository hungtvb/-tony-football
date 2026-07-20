import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTon80GameSource } from "../../scripts/normalize-ton80-game.mjs";
const generated=`(() => {
  function applyBallStyle() {  function applyBallStyle() {}
  function createParticleView() {}
  function drawFallbackPlayerDetail  function drawFallbackPlayerDetail(player,pose,replayFrame,selectedPlayerId) {}
  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();
  window.__TONY_DEBUG__.ready = true;
}
})();
`;
const imported=`import { createSimulationLoop } from "./src/game/core/SimulationLoop.js";\nimport("./src/game/config/gameplayConfig.js");\n${generated}`;
test("normalizes generated boundaries",()=>{const normalized=normalizeTon80GameSource(generated);assert.doesNotMatch(normalized,/function \w+\s+function \w+/);assert.equal((normalized.match(/function applyBallStyle\(\) \{/g)??[]).length,1);assert.doesNotThrow(()=>new Function(normalized));});
test("rebases generated imports",()=>{const normalized=normalizeTon80GameSource(imported);assert.match(normalized,/from "\.\.\/src\/game\/core\/SimulationLoop\.js"/);assert.match(normalized,/import\("\.\.\/src\/game\/config\/gameplayConfig\.js"\)/);});
test("normalization is idempotent",()=>{const normalized=normalizeTon80GameSource(imported);assert.equal(normalizeTon80GameSource(normalized),normalized);});
test("fails closed without bootstrap boundary",()=>assert.throws(()=>normalizeTon80GameSource(generated.replace("  window.__TONY_DEBUG__.ready = true;\n","")),/Missing generated TON-80 boundary/));
