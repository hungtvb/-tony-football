import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeSource = await readFile(new URL("../../game.js", import.meta.url), "utf8");

test("browser runtime delegates camera, replay, and gameplay feedback to presentation adapters", () => {
  assert.match(runtimeSource, /createSnapshotCameraController/);
  assert.match(runtimeSource, /createSnapshotReplayController/);
  assert.match(runtimeSource, /createBrowserPresentationFeedbackAdapter/);
  assert.doesNotMatch(runtimeSource, /game\.camera\b/);
  assert.doesNotMatch(runtimeSource, /function captureReplayFrame/);
  assert.doesNotMatch(runtimeSource, /game\.replay\.(?:frames|buffer|active|elapsed|accumulator)\s*=/);

  const releaseBallBody = runtimeSource.slice(runtimeSource.indexOf("function releaseBall"), runtimeSource.indexOf("function passBall"));
  const goalBody = runtimeSource.slice(runtimeSource.indexOf("function goal"), runtimeSource.indexOf("function updateReplay"));
  assert.doesNotMatch(releaseBallBody, /kickSound|spawnParticle/);
  assert.doesNotMatch(goalBody, /goalSound|spawnParticle/);
  assert.match(releaseBallBody, /GameEventType\.BALL_KICKED/);
  assert.match(goalBody, /GameEventType\.SCORE_CHANGED/);
  assert.match(goalBody, /scorerId: compatibilityPlayerId\(scorer\)/);
  assert.doesNotMatch(goalBody, /scorerId: possessionId\(scorer\)/);
});
