import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("generated runtime delegates camera and replay facts without directly projecting", () => {
  const generated = source("generated/game.js");
  assert.match(generated, /__TONY_CAMERA_REPLAY_BRIDGE__/);
  assert.match(generated, /getPresentationFrameFacts/);
  for (const forbidden of [
    "createSnapshotCameraController", "createSnapshotReplayController", "game.replay.update(",
    "game.replay.record(", "game.replay.start(", "game.replay.loadFrames(", "game.replay.syncElapsed(",
    "recordReplaySnapshot", "cameraController.update(compatibilitySnapshots.snapshot", "cameraReplayBridge.project(",
  ]) assert.equal(generated.includes(forbidden), false, `generated/game.js must not retain ${forbidden}`);
});

test("browser entry registers one exact-once camera replay owner before projected consumers", () => {
  const entry = source("browser-entry.js");
  assert.match(entry, /createSnapshotCameraReplayAdapter/);
  assert.match(entry, /__TONY_CAMERA_REPLAY_BRIDGE__/);
  assert.match(entry, /wrapProjectedAdapter/);
  assert.match(entry, /cameraReplay: projection/);
  assert.match(entry, /cameraReplayConsumer: owner/);
  assert.match(entry, /generated\/game\.js\?v=24\.0\.0/);
  assert.equal(entry.includes("cameraReplayAdapter.project("), false);
});

test("camera replay owner preserves current metadata and exposes no activation or progress mutators", () => {
  const owner = source("src/game/presentation/SnapshotCameraReplayAdapter.js");
  assert.match(owner, /match: current\.match/);
  assert.match(owner, /update\(\) \{ return false; \}/);
  assert.match(owner, /projectionSequence: latestProjection\?\.projectionSequence \?\? 0/);
  for (const forbidden of ["manualActive", "manualElapsed", "manualFrames", "start(finalSnapshot)", "loadFrames(", "syncElapsed(", "GameCommandType", "MatchEngine", "requestAnimationFrame", "setInterval", "setTimeout"]) {
    assert.equal(owner.includes(forbidden), false, `camera/replay owner must not contain ${forbidden}`);
  }
});

test("Canvas renderer requires and consumes the shared immutable camera replay contract", () => {
  const canvas = source("src/game/presentation/CanvasMatchRenderer.js");
  for (const contract of [
    "assertCameraReplayProjection(frame)",
    "frame.cameraReplay",
    "projection.renderSnapshot !== frame.snapshot",
    "cameraTransform(canvas, world, cameraReplay.camera)",
    "cameraReplay.replay.active",
    "projectionSequence: cameraReplay.projectionSequence",
  ]) assert.equal(canvas.includes(contract), true, `Canvas renderer must retain ${contract}`);
  assert.equal(canvas.includes("cameraController"), false);
  assert.equal(canvas.includes("SnapshotCameraReplayAdapter"), false);
});

test("bootstrap publishes camera facts once through the immutable presentation frame", () => {
  const bootstrap = source("src/game/application/BrowserBootstrapComposition.js");
  assert.match(bootstrap, /getPresentationFrameFacts/);
  assert.match(bootstrap, /\.\.\.extraFacts/);
  assert.equal(bootstrap.includes("SnapshotCameraReplayAdapter"), false);
  assert.equal(bootstrap.includes("__TONY_CAMERA_REPLAY_BRIDGE__"), false);
});
