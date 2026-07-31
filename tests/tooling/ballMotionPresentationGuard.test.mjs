import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, rootUrl), "utf8");

test("BallModelView consumes visual dynamics without owning ball simulation", async () => {
  const [viewSource, motionSource] = await Promise.all([
    read("src/game/presentation/BallModelView.js"),
    read("src/game/presentation/BallMotionPresentation.js"),
  ]);

  for (const contract of [
    'from "./BallMotionPresentation.js"',
    "createBallMotionPresentationState",
    "resetBallMotionPresentationState",
    "stepBallMotionPresentation",
    "TonyBallContactShadow",
    "meshScaleX",
    "meshScaleY",
    "shadowOpacity",
    "impactPulse",
  ]) assert.equal(viewSource.includes(contract), true, `BallModelView must retain ${contract}`);

  for (const contract of [
    "previousVz",
    "bounced",
    "impactPulse",
    "meshVerticalOffset",
    "shadowOpacity",
    "shadowScale",
    "rollX",
    "rollZ",
  ]) assert.equal(motionSource.includes(contract), true, `ball presentation must retain ${contract}`);

  for (const forbidden of [
    "ball.x =",
    "ball.y =",
    "ball.vx =",
    "ball.vy =",
    "ball.vz =",
    "ball.height =",
    "MatchEngine",
    "BallSimulationSystem",
    "dispatchEvent",
  ]) assert.equal(motionSource.includes(forbidden), false, `ball presentation must not own engine state: ${forbidden}`);
});

test("ball visual dynamics retain bounded deformation and shadow contracts", async () => {
  const source = await read("src/game/presentation/BallMotionPresentation.js");
  for (const bound of [
    "clamp(finite(dt, 1 / 60), 1 / 240, .05)",
    "height <= .08",
    "* .105",
    "* .52",
    ".055",
    ".34",
    "1.72",
    "state.previousVz < -3",
  ]) assert.equal(source.includes(bound), true, `ball presentation must retain bound ${bound}`);
});
