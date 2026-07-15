import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { ballControlConfig } from "../../src/game/config/ballControlConfig.js";
import { captureEligibility, dribbleAnchor } from "../../src/game/gameplay/BallControl.js";

const gameSource = await readFile(new URL("../../game.js", import.meta.url), "utf8");

test("runtime imports shared ball-control policy", () => {
  assert.match(gameSource, /ballControlConfig/);
  assert.match(gameSource, /captureEligibility/);
  assert.match(gameSource, /dribbleAnchor/);
});

test("capture policy preserves legacy outfield pickup boundary", () => {
  const inside = captureEligibility({ distance: 27.99, ballHeight: 1.05, ballSpeed: 0, locked: false, playerCooldown: 0, isGoalkeeper: false, isLastTouch: false, config: ballControlConfig.capture });
  const outside = captureEligibility({ distance: 28, ballHeight: 1.05, ballSpeed: 0, locked: false, playerCooldown: 0, isGoalkeeper: false, isLastTouch: false, config: ballControlConfig.capture });
  assert.equal(inside.eligible, true);
  assert.equal(outside.eligible, false);
});

test("precision anchor preserves legacy close-control values", () => {
  const owner = { x: 100, y: 200, vx: 0, vy: 0, dirX: 1, dirY: 0, radius: 17, dribbleSide: 1 };
  const anchor = dribbleAnchor({ owner, mode: "precision", stepPhase: 0, config: ballControlConfig.dribble });
  assert.equal(anchor.lead, 24);
  assert.equal(anchor.lateral, 0);
  assert.equal(anchor.followRate, 28);
});

test("normal anchor preserves legacy running-control values", () => {
  const owner = { x: 100, y: 200, vx: 110, vy: 0, dirX: 1, dirY: 0, radius: 17, dribbleSide: 1 };
  const anchor = dribbleAnchor({ owner, mode: "normal", stepPhase: 0, config: ballControlConfig.dribble });
  assert.equal(anchor.lead, 29);
  assert.equal(anchor.lateral, 3.8);
  assert.equal(anchor.followRate, 20);
});
