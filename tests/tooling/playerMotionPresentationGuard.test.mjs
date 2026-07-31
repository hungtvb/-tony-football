import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, rootUrl), "utf8");

test("Player V3 derives acceleration-aware pose without taking engine ownership", async () => {
  const [viewSource, motionSource] = await Promise.all([
    read("src/game/presentation/PlayerModelView.js"),
    read("src/game/presentation/PlayerMotionPresentation.js"),
  ]);

  for (const contract of [
    'from "./PlayerMotionPresentation.js"',
    "createPlayerMotionPresentationState",
    "resetPlayerMotionPresentationState",
    "stepPlayerMotionPresentation",
    "forwardAcceleration",
    "lateralAcceleration",
    "forwardLean",
    "lateralLean",
    "compression",
    "strideRate",
    "braking",
  ]) assert.equal(viewSource.includes(contract), true, `PlayerModelView must retain ${contract}`);

  for (const contract of [
    "cadenceFor",
    "targetForwardLean",
    "targetLateralLean",
    "targetCompression",
    "animationTimeScale",
    "previousVx",
    "previousVy",
  ]) assert.equal(motionSource.includes(contract), true, `motion presentation must retain ${contract}`);

  for (const forbidden of [
    "pose.vx =",
    "pose.vy =",
    "pose.x =",
    "pose.y =",
    "MatchEngine",
    "enqueue(",
    "dispatchEvent",
  ]) assert.equal(motionSource.includes(forbidden), false, `presentation must not own engine state: ${forbidden}`);
});

test("motion presentation bounds visual offsets and frame delta", async () => {
  const source = await read("src/game/presentation/PlayerMotionPresentation.js");
  for (const bound of [
    "clamp(finite(dt), 0, .05)",
    "-.085",
    ".17",
    "-.22",
    ".22",
    ".085",
    ".82",
    "1.42",
  ]) assert.equal(source.includes(bound), true, `motion presentation must retain bound ${bound}`);
});
