import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const entry = await readFile(new URL("../../browser-entry.js", import.meta.url), "utf8");
const cameraOwner = await readFile(new URL("../../src/game/presentation/SnapshotCameraReplayAdapter.js", import.meta.url), "utf8");
const cameraController = await readFile(new URL("../../src/game/presentation/SnapshotCameraController.js", import.meta.url), "utf8");
const radarAdapter = await readFile(new URL("../../src/game/presentation/RadarSnapshotAdapter.js", import.meta.url), "utf8");
const radarRenderer = await readFile(new URL("../../src/game/presentation/RadarSnapshotRenderer.js", import.meta.url), "utf8");
const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../u3-camera-hud.css", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = game.indexOf(startMarker);
  const end = game.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `${startMarker} must exist`);
  assert.ok(end > start, `${endMarker} must follow ${startMarker}`);
  return game.slice(start, end);
}

test("browser composition delegates shared framing to the snapshot camera owner", () => {
  assert.match(entry, /cameraHudConfig/);
  assert.match(entry, /createSnapshotCameraReplayAdapter/);
  assert.match(cameraOwner, /createSnapshotCameraController/);
  assert.match(cameraController, /cameraFrameTarget/);
  assert.match(cameraController, /cameraZoomForSpeed/);
  assert.doesNotMatch(game, /createSnapshotCameraController/);
});

test("snapshot camera controller removes the legacy speed zoom-in formula", () => {
  assert.doesNotMatch(cameraController, /1\.025 \+ ballSpeed \/ 9000/);
  assert.match(cameraController, /snapshot\.ball/);
  assert.match(cameraController, /cameraZoomForSpeed/);
  assert.match(cameraController, /cameraFrameTarget/);
});

test("WebGL and Canvas consumers receive the same framed camera projection", () => {
  assert.match(entry, /wrapProjectedAdapter/);
  assert.match(entry, /cameraReplay: projection/);
  assert.match(entry, /cameraReplayConsumer: owner/);
  assert.match(entry, /"webgl-model"/);
  assert.match(entry, /"canvas-match"/);
  assert.doesNotMatch(game, /function render3D/);
  assert.doesNotMatch(game, /function renderFallback2D/);
});

test("radar adapter owns the configured marker renderer without text", () => {
  assert.doesNotMatch(radarRenderer, /fillText/);
  assert.match(radarRenderer, /snapshot\.match\.selectedPlayerId/);
  assert.match(radarRenderer, /selectedRadius/);
  assert.match(radarRenderer, /ballRadius/);
  assert.match(radarAdapter, /claimRadarSnapshotContext/);
  assert.match(radarAdapter, /renderOwnedRadarSnapshot\(context, frame\.snapshot/);
  assert.doesNotMatch(game, /renderRadarSnapshot/);
  assert.doesNotMatch(game, /function drawRadar/);
});

test("U3 HUD stylesheet is loaded after U1 and reserves a desktop toast gap above radar", () => {
  const u1 = index.indexOf('href="u1-match-experience.css"');
  const u3 = index.indexOf('href="u3-camera-hud.css"');
  assert.ok(u1 >= 0 && u3 > u1);
  assert.match(css, /\.match-toast\s*\{[^}]*bottom:\s*clamp\(190px, 15vw, 236px\)/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.match-toast\s*\{[^}]*top:\s*8px/s);
});

test("integrated Playwright harness uses the existing pause overlay UI binding", () => {
  const source = sourceBetween("  function applyDebugScenario", "  window.__TONY_DEBUG__");
  assert.match(source, /ui\.pause\.classList\.remove\("show"\)/);
  assert.doesNotMatch(source, /ui\.pauseOverlay/);
  assert.match(game, /window\.__TONY_DEBUG__/);
});
