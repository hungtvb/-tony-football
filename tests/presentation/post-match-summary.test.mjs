import assert from "node:assert/strict";
import test from "node:test";

import {
  createPostMatchSummary,
  createPostMatchSummaryFromMatchEvent
} from "../../src/game/presentation/PostMatchSummary.js";

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

test("match-ended event facts project into the post-match summary", () => {
  const summary = createPostMatchSummaryFromMatchEvent({
    score: [2, 1],
    stats: {
      possession: [90, 60],
      shots: [8, 3],
      passes: 20,
      completed: 15
    }
  });

  assert.deepEqual(summary.score, [2, 1]);
  assert.deepEqual(summary.possession, [60, 40]);
  assert.deepEqual(summary.shots, [8, 3]);
  assert.equal(summary.passAccuracy, 75);
});
