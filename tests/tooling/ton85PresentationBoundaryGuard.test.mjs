import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("tracked game runtime contains only the named outward presentation port", () => {
  const source = read("game.js");
  const forbidden = ["new THREE.WebGLRenderer", "function init3D(", "function render3D(", "function updateUI(", "function tone(", "renderRadarSnapshot", "createHudSnapshotProjection", "createSnapshotRenderState", "__TONY_THREE_SCENE_BRIDGE__", "__TONY_MODEL_VIEW_BRIDGE__", "__TONY_CANVAS_MATCH_BRIDGE__", "__TONY_SETTINGS_EFFECTS_BRIDGE__"];
  for (const marker of forbidden) assert.equal(source.includes(marker), false, marker);
  assert.match(source, /__TONY_COMPATIBILITY_PRESENTATION_PORT__/);
  assert.match(source, /presentationPort\.recordBallTrail/);
  assert.match(source, /presentationPort\.stepEffects/);
});

test("browser composition owns adapters and declares the temporary bridge removal owner", () => {
  const source = read("browser-entry.js");
  assert.match(source, /createBrowserEffectsViewAdapter/);
  assert.match(source, /direction: "outward-only"/);
  assert.match(source, /removalOwner: "TON-65"/);
  assert.match(source, /Object\.freeze\(\[\s*\(\) => cameraReplayAdapter/);
});

test("architecture source map and stylesheet declare final owners", () => {
  for (const path of ["docs/05_ARCHITECTURE.md", "docs/11_SOURCE_MAP.md", "style.css"]) {
    if (!existsSync(path)) continue;
    const source = read(path); assert.match(source, /TON-85|adapter-owned presentation selectors/i, path);
  }
});
