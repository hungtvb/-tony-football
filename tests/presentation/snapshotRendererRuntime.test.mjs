import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const entry = await readFile(new URL("../../browser-entry.js", import.meta.url), "utf8");
const effects = await readFile(new URL("../../src/game/presentation/BrowserEffectsAdapter.js", import.meta.url), "utf8");
const modelViews = await readFile(new URL("../../src/game/presentation/BrowserModelViewAdapter.js", import.meta.url), "utf8");
const canvas = await readFile(new URL("../../src/game/presentation/CanvasMatchRenderer.js", import.meta.url), "utf8");

test("presentation frames create one immutable render state before WebGL and Canvas consumers", () => {
  assert.match(effects, /createSnapshotRenderState/);
  assert.match(effects, /frame\.renderState \?\?/);
  assert.match(effects, /Object\.freeze\(\{ \.\.\.frame, renderState/);
  assert.match(entry, /effectsAdapter\.projectFrame\(frame\)/);
  assert.match(entry, /"webgl-model"/);
  assert.match(entry, /"canvas-match"/);
  assert.doesNotMatch(game, /createSnapshotRenderState/);
});

test("WebGL player and ball views consume immutable render-state poses", () => {
  assert.match(modelViews, /frame\.renderState/);
  assert.match(modelViews, /renderState\.players/);
  assert.match(modelViews, /renderState\.ball/);
  assert.match(modelViews, /selectedPlayerId/);
  assert.match(modelViews, /ballOwnerId/);
  assert.doesNotMatch(game, /function render3D/);
});

test("rig facing uses interpolated ball facts and snapshot identities", () => {
  assert.match(modelViews, /renderState\.ball/);
  assert.match(modelViews, /selectedPlayerId/);
  assert.match(modelViews, /ballOwnerId/);
  assert.doesNotMatch(modelViews, /player===game\.selected/);
  assert.doesNotMatch(modelViews, /\bball\.owner/);
});

test("Canvas player and ball transforms consume the same render state", () => {
  assert.match(canvas, /frame\.renderState/);
  assert.match(canvas, /renderState\.players/);
  assert.match(canvas, /renderState\.ball/);
  assert.match(canvas, /snapshot\.match\.selectedPlayerId/);
  assert.doesNotMatch(game, /function renderFallback2D/);
});

test("historical replay is an explicit shared projection, not a renderer-local override", () => {
  assert.match(entry, /projectedPresentationFrame/);
  assert.match(entry, /snapshot: projection\.renderSnapshot/);
  assert.match(entry, /previousSnapshot: projection\.renderSnapshot/);
  assert.match(canvas, /frame\.cameraReplay/);
  assert.match(canvas, /cameraReplay\.replay\.active/);
  assert.doesNotMatch(modelViews, /currentReplayFrame/);
  assert.doesNotMatch(canvas, /currentReplayFrame/);
});
