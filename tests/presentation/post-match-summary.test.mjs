import assert from "node:assert/strict";
import test from "node:test";

import { createPostMatchSummary } from "../../src/game/presentation/PostMatchSummary.js";

test("post-match summary classifies a Tony FC win", () => {
  const summary = createPostMatchSummary({
    homeScore: 3,
    awayScore: 1,
    homePossession: 62,
    homeShots: 10,
    awayShots: 4,
    passAccuracy: 84,
  });

  assert.equal(summary.outcome, "win");
  assert.equal(summary.title, "CHIẾN THẮNG!");
  assert.deepEqual(summary.score, [3, 1]);
  assert.deepEqual(summary.possession, [62, 38]);
  assert.deepEqual(summary.shots, [10, 4]);
  assert.equal(summary.passAccuracy, 84);
});

test("post-match summary supports draw and loss outcomes", () => {
  assert.equal(createPostMatchSummary({ homeScore: 2, awayScore: 2 }).outcome, "draw");
  assert.equal(createPostMatchSummary({ homeScore: 0, awayScore: 1 }).outcome, "loss");
});

test("post-match summary clamps invalid statistics", () => {
  const summary = createPostMatchSummary({
    homeScore: -2,
    awayScore: "4.4",
    homePossession: 130,
    homeShots: -7,
    awayShots: "bad",
    passAccuracy: -20,
  });

  assert.deepEqual(summary.score, [0, 4]);
  assert.deepEqual(summary.possession, [100, 0]);
  assert.deepEqual(summary.shots, [0, 0]);
  assert.equal(summary.passAccuracy, 0);
});
