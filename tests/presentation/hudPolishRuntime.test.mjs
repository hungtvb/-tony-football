import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../u3-camera-hud.css", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = game.indexOf(`  function ${name}`);
  const end = game.indexOf(`  function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${nextName} must follow ${name}`);
  return game.slice(start, end);
}

test("HUD runtime binds the player card and tracks selected identity", () => {
  assert.match(game, /playerCard:document\.querySelector\("\.hud-player-card"\)/);
  assert.match(game, /hud:\s*\{\s*selectedKey:/);
});

test("player changes trigger a restrained card transition", () => {
  const source = functionSource("updateUI", "announce");
  assert.match(source, /selectedKey/);
  assert.match(source, /player-change/);
  assert.match(css, /@keyframes u31-player-change/);
});

test("low stamina uses a class state instead of rapid flashing", () => {
  const source = functionSource("updateUI", "announce");
  assert.match(source, /low-stamina/);
  assert.doesNotMatch(css, /low-stamina[^}]*animation:[^;]*(infinite|steps)/s);
  assert.match(css, /\.hud-player-card\.low-stamina/);
});

test("control hints dim after onboarding and reactivate during input", () => {
  const source = functionSource("updateUI", "announce");
  assert.match(source, /onboardingElapsed>18/);
  assert.match(source, /hints-dimmed/);
  assert.match(source, /hints-active/);
  assert.match(css, /\.hud-controls\.hints-dimmed/);
});

test("reduced motion disables player-change animation", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.hud-player-card\.player-change\s*\{[^}]*animation:\s*none/s);
});
