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
  const goalBody = runtimeSource.slice(runtimeSource.indexOf("function goal"), runtimeSource.indexOf("function updateLegacyReplay"));
  assert.doesNotMatch(releaseBallBody, /kickSound|spawnParticle/);
  assert.doesNotMatch(goalBody, /goalSound|spawnParticle/);
  assert.match(releaseBallBody, /GameEventType\.BALL_KICKED/);
  assert.match(goalBody, /GameEventType\.SCORE_CHANGED/);
  assert.match(goalBody, /scorerId: compatibilityPlayerId\(scorer\)/);
  assert.doesNotMatch(goalBody, /scorerId: possessionId\(scorer\)/);
});


test("compatibility kick events publish after action-specific ball mutations", () => {
  const releaseBallBody = runtimeSource.slice(runtimeSource.indexOf("function releaseBall"), runtimeSource.indexOf("function passBall"));
  const throughBallBody = runtimeSource.slice(runtimeSource.indexOf("function throughBall"), runtimeSource.indexOf("function loftBall"));
  const loftBallBody = runtimeSource.slice(runtimeSource.indexOf("function loftBall"), runtimeSource.indexOf("function shootBall"));
  const shootBallBody = runtimeSource.slice(runtimeSource.indexOf("function shootBall"), runtimeSource.indexOf("function tackle"));

  assert.match(releaseBallBody, /return createDeferredCompatibilityKickPublisher/);
  assert.equal(releaseBallBody.includes("publishKickEvent()"), false);

  assert.ok(throughBallBody.indexOf("ball.vz=8.6+charge*4.2") < throughBallBody.indexOf("publishKickEvent()"));
  assert.ok(loftBallBody.indexOf("ball.vz*=lerp(.82,1.14,charge)") < loftBallBody.indexOf("publishKickEvent()"));
  assert.ok(shootBallBody.indexOf("ball.vz=10.5+power*4.5") < shootBallBody.indexOf("publishKickEvent()"));
  assert.ok(shootBallBody.indexOf("ball.vz=2.6") < shootBallBody.indexOf("publishKickEvent()"));
});
