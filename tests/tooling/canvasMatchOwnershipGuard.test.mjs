import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const generated = () => readFileSync(new URL("../../generated/game.js", import.meta.url), "utf8");
const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("generated compatibility runtime no longer owns the match Canvas renderer", () => {
  const text = generated();
  for (const token of ["renderFallback2D", "drawFallbackPlayerDetail", 'canvas.getContext("2d")', "function drawPitch(", "function drawPlayer(", "function drawBall(", "function drawEffects(", "function drawScreenEffects("]) {
    assert.equal(text.includes(token), false, `generated/game.js must not contain ${token}`);
  }
  assert.match(text, /__TONY_CANVAS_MATCH_BRIDGE__/);
});

test("Canvas ownership stays under presentation and out of engine/application modules", () => {
  const renderer = source("src/game/presentation/CanvasMatchRenderer.js");
  assert.match(renderer, /createSnapshotRenderState/);
  assert.match(renderer, /getContext\?\.\("2d"\)/);
  for (const path of ["src/game/engine/MatchEngine.js", "src/game/engine/MatchState.js", "src/game/application/BrowserBootstrapComposition.js"]) {
    const text = source(path);
    assert.equal(/getContext\s*\(|CanvasRenderingContext2D|HTMLCanvasElement/.test(text), false, `${path} must remain Canvas-free`);
  }
});
