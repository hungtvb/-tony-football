import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../u3-camera-hud.css", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = game.indexOf(`  function ${name}`);
  const end = game.indexOf(`  function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${nextName} must follow ${name}`);
  return game.slice(start, end);
}

test("runtime imports shared camera framing policy", () => {
  assert.match(game, /cameraHudConfig/);
  assert.match(game, /cameraFrameTarget/);
  assert.match(game, /cameraZoomForSpeed/);
});

test("camera runtime removes the legacy speed zoom-in formula", () => {
  const source = functionSource("updateCamera", "update");
  assert.doesNotMatch(source, /1\.025 \+ ballSpeed \/ 9000/);
  assert.match(source, /cameraZoomForSpeed/);
  assert.match(source, /cameraFrameTarget/);
});

test("WebGL broadcast camera consumes the framed camera target", () => {
  const source = functionSource("render3D", "drawFallbackPlayerDetail");
  assert.match(source, /game\.camera\.x/);
  assert.match(source, /game\.camera\.y/);
  assert.match(source, /zoomScale/);
});

test("radar plot contains no text rendering and uses configured markers", () => {
  const source = functionSource("drawRadar", "updateUI");
  assert.doesNotMatch(source, /fillText/);
  assert.match(source, /cameraHudConfig\.radar/);
  assert.match(source, /selectedRadius/);
  assert.match(source, /ballRadius/);
});

test("U3 HUD stylesheet is loaded after U1 and reserves a desktop toast gap above radar", () => {
  const u1 = index.indexOf('href="u1-match-experience.css"');
  const u3 = index.indexOf('href="u3-camera-hud.css"');
  assert.ok(u1 >= 0 && u3 > u1);
  assert.match(css, /\.match-toast\s*\{[^}]*bottom:\s*clamp\(190px, 15vw, 236px\)/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.match-toast\s*\{[^}]*top:\s*8px/s);
});

test("integrated Playwright harness uses the existing pause overlay UI binding", () => {
  const source = functionSource("applyDebugScenario", "resize");
  assert.match(source, /ui\.pause\.classList\.remove\("show"\)/);
  assert.doesNotMatch(source, /ui\.pauseOverlay/);
  assert.match(game, /window\.__TONY_DEBUG__/);
});
