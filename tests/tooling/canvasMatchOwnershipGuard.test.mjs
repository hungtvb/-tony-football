import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { prepareTon80Game } from "../../scripts/prepare-ton80-game.mjs";

const generated = () => readFileSync(new URL("../../generated/game.js", import.meta.url), "utf8");
const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("generated compatibility runtime no longer owns the match Canvas renderer", () => {
  prepareTon80Game();
  const text = generated();
  const forbidden = ["renderFallback2D", "drawFallbackPlayerDetail", "canvas.getContext", "function drawPitch(", "function drawPlayer(", "function drawBall(", "function drawEffects(", "function drawScreenEffects("];
  for (const token of forbidden) assert.equal(text.includes(token), false, `generated/game.js must not contain ${token}`);
  assert.equal(text.includes("__TONY_CANVAS_MATCH_BRIDGE__"), true);
});

test("Canvas ownership stays under presentation and out of engine/application modules", () => {
  const renderer = source("src/game/presentation/CanvasMatchRenderer.js");
  assert.equal(renderer.includes("createSnapshotRenderState"), true);
  assert.equal(renderer.includes("getContext?.(\"2d\")"), true);
  for (const path of ["src/game/engine/MatchEngine.js", "src/game/engine/MatchState.js", "src/game/application/BrowserBootstrapComposition.js"]) {
    const text = source(path);
    assert.equal(text.includes("getContext("), false, `${path} must remain Canvas-free`);
    assert.equal(text.includes("CanvasRenderingContext2D"), false, `${path} must remain Canvas-free`);
    assert.equal(text.includes("HTMLCanvasElement"), false, `${path} must remain Canvas-free`);
  }
});
