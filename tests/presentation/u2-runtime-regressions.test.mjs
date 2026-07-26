import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const audioAdapter = await readFile(new URL("../../src/game/presentation/BrowserAudioAdapter.js", import.meta.url), "utf8");
const effectsAdapter = await readFile(new URL("../../src/game/presentation/BrowserEffectsAdapter.js", import.meta.url), "utf8");
const canvasRenderer = await readFile(new URL("../../src/game/presentation/CanvasMatchRenderer.js", import.meta.url), "utf8");
const snapshotAdapter = await readFile(new URL("../../src/game/presentation/CompatibilitySnapshotAdapter.js", import.meta.url), "utf8");
const compactSource = source.replace(/\s+/g, "");

test("audio cooldown uses one injected monotonic clock domain", () => {
  assert.match(audioAdapter, /nowSeconds = \(\) => \(target\?\.performance\?\.now/);
  assert.match(audioAdapter, /controller\.canPlay\("kick", nowSeconds\(\)\)/);
  assert.match(audioAdapter, /controller\.canPlay\("goal", nowSeconds\(\)\)/);
  assert.doesNotMatch(audioAdapter, /audioContext\?\.currentTime \?\?/);
  assert.doesNotMatch(source, /function audioNow/);
});

test("replay snapshots and shared effect projection retain ball velocity and trail", () => {
  assert.match(snapshotAdapter, /"vx", "vy"/);
  assert.match(snapshotAdapter, /trail: \(ball\.trail \?\? \[\]\)\.map/);
  assert.match(effectsAdapter, /trail: Object\.freeze\(trail\.map\(copyPoint\)\)/);
  assert.match(effectsAdapter, /Math\.hypot\(Number\(frame\.snapshot\?\.ball\?\.vx/);
  assert.match(canvasRenderer, /drawEffects\(context, frame\.effects\)/);
  assert.match(canvasRenderer, /effects\.trail/);
  assert.doesNotMatch(source, /game\.replay\.record\(/);
});

test("goal presentation retains one authoritative sequence duration", () => {
  assert.ok(compactSource.includes("timer:goalDuration,duration:goalDuration"));
});
