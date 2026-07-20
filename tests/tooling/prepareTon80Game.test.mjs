import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { classifyTon80GameSource, prepareTon80Game } from "../../scripts/prepare-ton80-game.mjs";

const legacySource = [
  "new THREE.WebGLRenderer",
  "new EffectComposer(",
  "new RoomEnvironment(",
  "new THREE.AnimationMixer",
].join("\n");

const preparedSource = [
  "  let threeScenePort = null;",
  "  function applyBallStyle() { return true; }",
  "  function createParticleView() {}",
  "  function drawFallbackPlayerDetail(player,pose,replayFrame,selectedPlayerId) {}",
  "    onPresentationReady: init3D,",
  "window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.()",
  "window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.()",
  "  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();",
  "  window.__TONY_DEBUG__.ready = true;",
  "})();",
].join("\n") + "\n";

function workspace(source) {
  const cwd = mkdtempSync(join(tmpdir(), "presentation-prepare-"));
  mkdirSync(join(cwd, "scripts"), { recursive: true });
  writeFileSync(join(cwd, "game.js"), source);
  writeFileSync(join(cwd, "scripts/ton-80-migrate-game.py"), "# test stub\n");
  return cwd;
}

test("classifies legacy, prepared and partial generated sources", () => {
  assert.equal(classifyTon80GameSource(legacySource), "legacy");
  assert.equal(classifyTon80GameSource(preparedSource), "prepared");
  assert.equal(classifyTon80GameSource(`${legacySource}\nlet threeScenePort = null;`), "inconsistent");
});

test("generation writes a separate deterministic artifact and leaves tracked source byte-identical", () => {
  const cwd = workspace(legacySource);
  const original = readFileSync(join(cwd, "game.js"), "utf8");
  const run = (_command, _args, options) => {
    writeFileSync(join(options.cwd, "game.js"), preparedSource);
    return { status: 0 };
  };
  const first = prepareTon80Game({ cwd, run });
  const second = prepareTon80Game({ cwd, run });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(readFileSync(join(cwd, "game.js"), "utf8"), original);
  assert.equal(readFileSync(join(cwd, "generated/game.js"), "utf8"), preparedSource);
});

test("tracked prepared or partial sources fail closed", () => {
  for (const source of [preparedSource, `${legacySource}\nlet threeScenePort = null;`]) {
    const cwd = workspace(source);
    assert.throws(() => prepareTon80Game({ cwd, run: () => ({ status: 0 }) }), /canonical legacy migration input/);
  }
});
