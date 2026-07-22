import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("TON-84 generated runtime consumes the single settings/effects bridge", async () => {
  const [generated, entry, settings, effects, ballView, canvasRenderer] = await Promise.all([
    readFile("generated/game.js", "utf8"), readFile("browser-entry.js", "utf8"),
    readFile("src/game/presentation/BrowserSettingsAdapter.js", "utf8"), readFile("src/game/presentation/BrowserEffectsAdapter.js", "utf8"),
    readFile("src/game/presentation/BallModelView.js", "utf8"), readFile("src/game/presentation/CanvasMatchRenderer.js", "utf8"),
  ]);
  for (const contract of ["window.__TONY_SETTINGS_EFFECTS_BRIDGE__", "settingsEffectsBridge.settings.configure", "settingsEffectsBridge.effects.projectTrail", "settingsEffectsBridge.effects.snapshot"]) assert.ok(generated.includes(contract), `missing generated contract ${contract}`);
  for (const forbidden of ["game.particles", "function spawnParticle(", "function spawnContextParticles(", "function updateParticles(", 'savePreference("tfPitch"', 'savePreference("tfBall"', 'savePreference("tfWeather"', '$("soundButton").addEventListener']) assert.equal(generated.includes(forbidden), false, `generated runtime still owns ${forbidden}`);
  for (const contract of ["createBrowserSettingsAdapter", "createBrowserEffectsAdapter", "__TONY_SETTINGS_EFFECTS_BRIDGE__", "FO4_CONTROLS"]) assert.ok(entry.includes(contract), `entry missing ${contract}`);
  assert.ok(settings.includes("source: \"user-preference\"")); assert.ok(settings.includes("browser settings owner already attached"));
  assert.ok(effects.includes("browser effects owner already attached")); assert.ok(effects.includes("Object.freeze"));
  assert.ok(entry.includes("effectsAdapter.projectFrame(frame)")); assert.ok(effects.includes("function projectCharge")); assert.ok(effects.includes("function projectFrame"));
  assert.ok(ballView.includes("activeCharge.color")); assert.ok(canvasRenderer.includes("activeCharge.color"));
});
