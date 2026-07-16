import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = game.indexOf(`  function ${name}`);
  const end = game.indexOf(`  function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${nextName} must follow ${name}`);
  return game.slice(start, end);
}

test("render frames create one immutable interpolated state for both renderers", () => {
  assert.match(game, /import \{ createSnapshotRenderState \}/);
  const source = functionSource("renderFrame", "applyCompatibilityCommand");
  assert.match(source, /createSnapshotRenderState\(frame\)/);
  assert.match(source, /render\(now, frame\.current, lastSnapshotRenderState\)/);
});

test("WebGL player and ball transforms consume render-state poses", () => {
  const source = functionSource("render3D", "drawFallbackPlayerDetail");
  assert.match(source, /renderState\.players\[index\]/);
  assert.match(source, /renderState\.ball/);
  assert.match(source, /ballView\.position\.set\(worldX\(renderBall\.x\)/);
  assert.doesNotMatch(source, /replayFrame\?\.ball\|\|ball/);
  assert.doesNotMatch(source, /replayFrame\?\.players\[index\]\|\|player/);
});

test("rig facing uses the interpolated ball and snapshot identities", () => {
  const source = functionSource("updateRigPlayer", "cssColor");
  assert.match(source, /renderFacts\.ball\.x-pose\.x/);
  assert.match(source, /renderFacts\.selectedPlayerId/);
  assert.match(source, /renderFacts\.ballOwnerId/);
  assert.doesNotMatch(source, /normalize\(ball\.x/);
  assert.doesNotMatch(source, /\bball\.owner/);
  assert.doesNotMatch(source, /player===game\.selected/);
});

test("Canvas player and ball transforms consume the same render state", () => {
  const source = functionSource("renderFallback2D", "drawPitch");
  assert.match(source, /renderState\.players\[index\]/);
  assert.match(source, /renderState\.ball/);
  assert.match(source, /snapshot\.match\.selectedPlayerId/);
  assert.doesNotMatch(source, /replayFrame\?\.ball\|\|ball/);
  assert.doesNotMatch(source, /replayFrame\?\.players\[index\]\|\|player/);
});

test("legacy replay frames remain the explicit renderer override", () => {
  const webgl = functionSource("render3D", "drawFallbackPlayerDetail");
  const canvas = functionSource("renderFallback2D", "drawPitch");
  assert.match(webgl, /currentReplayFrame\(\)/);
  assert.match(webgl, /replayFrame\?\.players\[index\]/);
  assert.match(canvas, /currentReplayFrame\(\)/);
  assert.match(canvas, /replayFrame\?\.players\[index\]/);
});
