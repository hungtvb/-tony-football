import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTon80GameSource } from "../../scripts/normalize-ton80-game.mjs";
const generated=`(() => {
  function applyBallStyle() {  function applyBallStyle() {}
  function createParticleView() {}
  function render(now, snapshot, renderState) { return render3D(now, snapshot, renderState); }
  const canvasMatch = window.__TONY_CANVAS_MATCH_BRIDGE__?.diagnostics?.();
  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();
  window.__TONY_DEBUG__.ready = true;
}
})();
`;
const imported=`import { createSimulationLoop } from "./src/game/core/SimulationLoop.js";\nimport("./src/game/config/gameplayConfig.js");\n${generated}`;
test("normalizes generated boundaries",()=>{const normalized=normalizeTon80GameSource(generated);assert.doesNotMatch(normalized,/function \w+\s+function \w+/);assert.equal(normalized.split("function applyBallStyle() {").length-1,1);assert.doesNotThrow(()=>new Function(normalized));});
test("rebases generated imports",()=>{const normalized=normalizeTon80GameSource(imported);assert.match(normalized,/from "\.\.\/src\/game\/core\/SimulationLoop\.js"/);assert.match(normalized,/import\("\.\.\/src\/game\/config\/gameplayConfig\.js"\)/);});
test("normalization is idempotent",()=>{const normalized=normalizeTon80GameSource(imported);assert.equal(normalizeTon80GameSource(normalized),normalized);});
test("normalizes Windows line endings before validating generated boundaries",()=>{const normalized=normalizeTon80GameSource(generated.replaceAll("\n","\r\n"));assert.equal(normalized,normalizeTon80GameSource(generated));});
test("fails closed without bootstrap boundary",()=>assert.throws(()=>normalizeTon80GameSource(generated.replace("  window.__TONY_DEBUG__.ready = true;\n","")),/Missing generated TON-82 boundary/));
test("fails closed when legacy Canvas ownership remains",()=>assert.throws(()=>normalizeTon80GameSource(`${generated}\nfunction renderFallback2D(){}`),/Canvas ownership remains/));
