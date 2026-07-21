import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("generated runtime delegates camera and replay projection to the presentation bridge", () => {
  const generated = source("generated/game.js");
  assert.match(generated, /__TONY_CAMERA_REPLAY_BRIDGE__/);
  for (const forbidden of [
    "createSnapshotCameraController",
    "createSnapshotReplayController",
    "game.replay.update(",
    "game.replay.record(",
    "recordReplaySnapshot",
    "cameraController.update(compatibilitySnapshots.snapshot",
  ]) assert.equal(generated.includes(forbidden), false, `generated/game.js must not retain ${forbidden}`);
});

test("browser entry registers one shared camera replay owner before projected renderers", () => {
  const entry = source("browser-entry.js");
  assert.match(entry, /createSnapshotCameraReplayAdapter/);
  assert.match(entry, /__TONY_CAMERA_REPLAY_BRIDGE__/);
  assert.match(entry, /wrapProjectedAdapter/);
  assert.match(entry, /generated\/game\.js\?v=23\.0\.0/);
});

test("camera replay owner remains presentation-only and cannot mutate authoritative match state", () => {
  const owner = source("src/game/presentation/SnapshotCameraReplayAdapter.js");
  assert.match(owner, /snapshot\.match\.replay/);
  assert.match(owner, /update\(\) \{ return false; \}/);
  for (const forbidden of [
    "GameCommandType",
    "MatchEngine",
    "enqueue(",
    ".match.score =",
    ".match.time =",
    ".ball.ownerId =",
    "requestAnimationFrame",
    "setInterval",
    "setTimeout",
  ]) assert.equal(owner.includes(forbidden), false, `camera/replay owner must not contain ${forbidden}`);
});

test("engine and application layers stay free of presentation camera replay dependencies", () => {
  for (const path of [
    "src/game/engine/MatchEngine.js",
    "src/game/engine/MatchState.js",
    "src/game/application/BrowserBootstrapComposition.js",
    "src/game/application/BrowserRuntimeComposition.js",
  ]) {
    const text = source(path);
    assert.equal(text.includes("SnapshotCameraReplayAdapter"), false, `${path} must not depend on presentation camera/replay owner`);
    assert.equal(text.includes("__TONY_CAMERA_REPLAY_BRIDGE__"), false, `${path} must not depend on browser bridge`);
  }
});
