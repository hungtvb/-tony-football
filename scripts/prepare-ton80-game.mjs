import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeTon80GameSource } from "./normalize-ton80-game.mjs";

const FINAL_MARKERS = Object.freeze([
  "window.__TONY_COMPATIBILITY_PRESENTATION_PORT__",
  "new BrowserBootstrapComposition",
  "createBrowserPresentationFeedbackAdapter",
]);
const MIGRATED_OWNER_MARKERS = Object.freeze([
  "new THREE.WebGLRenderer", "function init3D(", "function render3D(", "function updateUI(",
  "function tone(", "renderRadarSnapshot", "createHudSnapshotProjection", "createSnapshotRenderState",
  "__TONY_THREE_SCENE_BRIDGE__", "__TONY_MODEL_VIEW_BRIDGE__", "__TONY_CANVAS_MATCH_BRIDGE__",
  "__TONY_SETTINGS_EFFECTS_BRIDGE__",
]);

export function classifyTon80GameSource(source) {
  if (FINAL_MARKERS.every((marker) => source.includes(marker)) && MIGRATED_OWNER_MARKERS.every((marker) => !source.includes(marker))) return "final";
  return "inconsistent";
}

export function prepareTon80Game({ cwd = process.cwd() } = {}) {
  const sourcePath = resolve(cwd, "game.js"); const outputPath = resolve(cwd, "generated/game.js");
  const source = readFileSync(sourcePath, "utf8");
  if (classifyTon80GameSource(source) !== "final") throw new Error("Tracked game.js must satisfy the TON-85 final presentation boundary");
  const generated = normalizeTon80GameSource(source); mkdirSync(dirname(outputPath), { recursive: true });
  const previous = (() => { try { return readFileSync(outputPath, "utf8"); } catch { return null; } })();
  writeFileSync(outputPath, generated, "utf8");
  if (readFileSync(sourcePath, "utf8") !== source) throw new Error("Generation mutated tracked game.js");
  console.log(previous === generated ? "TON-85 runtime artifact unchanged" : "TON-85 runtime artifact prepared");
  return Object.freeze({ state: "final", changed: previous !== generated, outputPath });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try { prepareTon80Game(); } catch (error) { console.error(error?.stack ?? error); process.exitCode = 1; }
}
