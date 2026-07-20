import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_BOUNDARIES = Object.freeze([
  "  let threeScenePort = null;",
  "  function applyBallStyle() { return true; }",
  "  function createParticleView() {",
  "  function drawFallbackPlayerDetail(player,pose,replayFrame,selectedPlayerId) {",
  "    onPresentationReady: init3D,",
  "window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.()",
  "  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();",
  "  window.__TONY_DEBUG__.ready = true;",
]);

const FORBIDDEN_MODEL_OWNERSHIP = Object.freeze([
  "GLTFLoader",
  "cloneSkeleton",
  "MeshoptDecoder",
  "playerViews",
  "playerAsset",
  "createPlayerView",
  "upgradePlayerView",
  "new THREE.AnimationMixer",
  "createBall3D",
  "ballView",
  "chargeView",
  "createChargeView",
  "updatePlayerView",
  "updateRigPlayer",
  "applyIntegratedFootballKit",
  "createBallSurfaceTextures",
]);

function rebaseGeneratedModuleImports(source) {
  return source
    .replace(/(\bfrom\s+["'])\.\/src\//g, "$1../src/")
    .replace(/(\bimport\s*\(\s*["'])\.\/src\//g, "$1../src/");
}

export function normalizeTon80GameSource(source) {
  let normalized = rebaseGeneratedModuleImports(source);
  if (normalized.includes("\n}\n})();\n")) {
    normalized = normalized.replace("\n}\n})();\n", "\n})();\n");
  }

  for (const marker of REQUIRED_BOUNDARIES) {
    if (!normalized.includes(marker)) throw new Error(`Missing generated presentation boundary: ${marker.trim()}`);
  }
  for (const marker of FORBIDDEN_MODEL_OWNERSHIP) {
    if (normalized.includes(marker)) throw new Error(`Generated runtime retains TON-81 ownership: ${marker}`);
  }
  if ((normalized.match(/function applyBallStyle\(\) \{ return true; \}/g) ?? []).length !== 1) {
    throw new Error("Expected exactly one generated applyBallStyle compatibility no-op");
  }
  const closingBoundary = "\n})();\n";
  if (normalized.split(closingBoundary).length - 1 !== 1) {
    throw new Error("Expected one generated IIFE closing boundary");
  }
  if (normalized.includes("\n}\n})();\n")) {
    throw new Error("Generated bootstrap remains nested behind an extra closing brace");
  }
  if (/\bfrom\s+["']\.\/src\//.test(normalized) || /\bimport\s*\(\s*["']\.\/src\//.test(normalized)) {
    throw new Error("Generated module imports still resolve beneath the generated directory");
  }
  return normalized;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [inputArgument, outputArgument] = process.argv.slice(2);
  if (!inputArgument || !outputArgument) {
    throw new Error("normalize-ton80-game requires explicit input and output paths");
  }
  const inputPath = resolve(inputArgument);
  const outputPath = resolve(outputArgument);
  writeFileSync(outputPath, normalizeTon80GameSource(readFileSync(inputPath, "utf8")), "utf8");
}
