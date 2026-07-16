import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const cameraController = await readFile(new URL("../../src/game/presentation/SnapshotCameraController.js", import.meta.url), "utf8");
const radarRenderer = await readFile(new URL("../../src/game/presentation/RadarSnapshotRenderer.js", import.meta.url), "utf8");
const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../u3-camera-hud.css", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = game.indexOf(`  function ${name}`);
  const end = game.indexOf(`  function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${nextName} must follow ${name}`);
  return game.slice(start, end);
}

function sourceBetween(startMarker, endMarker) {
  const start = game.indexOf(startMarker);
  const end = game.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `${startMarker} must exist`);
  assert.ok(end > start, `${endMarker} must follow ${startMarker}`);
  return game.slice(start, end);
}

test("runtime delegates shared framing policy to the snapshot camera controller", () => {
  assert.match(game, /cameraHudConfig/);
  assert.match(game, /createSnapshotCameraController/);
  assert.match(cameraController, /cameraFrameTarget/);
  assert.match(cameraController, /cameraZoomForSpeed/);
});

test("snapshot camera controller removes the legacy speed zoom-in formula", () => {
  assert.doesNotMatch(cameraController, /1\.025 \+ ballSpeed \/ 9000/);
  assert.match(cameraController, /snapshot\.ball/);
  assert.match(cameraController, /cameraZoomForSpeed/);
  assert.match(cameraController, /cameraFrameTarget/);
});

test("WebGL broadcast camera consumes the framed camera target", () => {
  const source = functionSource("render3D", "drawFallbackPlayerDetail");
  assert.match(source, /cameraController\.state/);
  assert.match(source, /cameraState\.x/);
  assert.match(source, /cameraState\.y/);
  assert.match(source, /zoomScale/);
});

test("radar plot contains no text rendering and uses configured markers", () => {
  assert.doesNotMatch(radarRenderer, /fillText/);
  assert.match(radarRenderer, /snapshot\.match\.selectedPlayerId/);
  assert.match(radarRenderer, /selectedRadius/);
  assert.match(radarRenderer, /ballRadius/);
  assert.match(game, /renderRadarSnapshot\(rctx,snapshot/);
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
