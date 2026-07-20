import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve("scripts/ton-82-migrate-canvas.py");
const preparedInput = `  let ballTrailView; let particleView; let screenFx; let ctx; let use3D = true;\n  function init3D() {\n    if (rendererPreference === "canvas") {\n      use3D = false;\n      ctx = canvas.getContext("2d");\n      return false;\n    }\n    if (!threeScenePort) {\n      use3D = false;\n      ctx = canvas.getContext("2d");\n      ui.commentary.textContent = "WebGL không khả dụng · Đang chạy chế độ tương thích 2D";\n      return false;\n    }\n  }\n  function drawFallbackPlayerDetail() {}\n  function renderFallback2D() {}\n  function drawPitch() {}\n  function drawPlayer() {}\n  function drawBall() {}\n  function drawEffects() {}\n  function drawScreenEffects() {}\n  function render(now, snapshot, renderState) { if (use3D) render3D(now, snapshot, renderState); else renderFallback2D(now, snapshot, renderState); }\n  function updateUI() {}\n      modelViews: window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "browser-model-views", attached: false }),\n`;

function run(source) {
  const cwd = mkdtempSync(join(tmpdir(), "ton82-canvas-"));
  writeFileSync(join(cwd, "game.js"), source);
  const result = spawnSync("python3", [script], { cwd, encoding: "utf8" });
  return { result, output: readFileSync(join(cwd, "game.js"), "utf8") };
}

test("TON-82 migration removes match Canvas ownership and adds diagnostics", () => {
  const { result, output } = run(preparedInput);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(output.includes("renderFallback2D"), false);
  assert.equal(output.includes("canvas.getContext"), false);
  assert.equal(output.includes("__TONY_CANVAS_MATCH_BRIDGE__"), true);
  assert.match(output, /if \(!use3D\) return false/);
});

test("TON-82 migration fails closed when expected ownership markers are absent", () => {
  const { result } = run("const untouched = true;\n");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected one match|markers missing/);
});
