import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const hud = await readFile(new URL("../../src/game/presentation/DomHudAdapter.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../u3-camera-hud.css", import.meta.url), "utf8");

test("HUD adapter owns the player card and selected identity projection", () => {
  assert.match(hud, /playerCard: queryOne\(document, "\.hud-player-card"\)/);
  assert.match(hud, /createHudSnapshotProjection\(snapshot\)/);
  assert.match(hud, /selectedPlayerId/);
  assert.doesNotMatch(hud, /game\.(score|stats|selected|time)/);
  assert.doesNotMatch(game, /function updateUI/);
});

test("player changes trigger a restrained card transition", () => {
  assert.match(hud, /selectedPlayerId !== player\.id/);
  assert.match(hud, /"player-change"/);
  assert.match(css, /@keyframes u31-player-change/);
});

test("low stamina uses a class state instead of rapid flashing", () => {
  assert.match(hud, /player\.stamina < 25/);
  assert.match(hud, /"low-stamina"/);
  assert.doesNotMatch(css, /low-stamina[^}]*animation:[^;]*(infinite|steps)/s);
  assert.match(css, /\.hud-player-card\.low-stamina/);
});

test("control hints dim after onboarding and reactivate during input", () => {
  assert.match(hud, /hud\.elapsed > 18/);
  assert.match(hud, /"hints-dimmed"/);
  assert.match(hud, /"hints-active"/);
  assert.match(css, /\.hud-controls\.hints-dimmed/);
});

test("reduced motion disables player-change animation", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.hud-player-card\.player-change\s*\{[^}]*animation:\s*none/s);
});
