import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuFlow = await readFile(new URL("../../src/game/presentation/MainMenuFlow.js", import.meta.url), "utf8");
const goalFlow = await readFile(new URL("../../src/game/presentation/GoalPresentationFlow.js", import.meta.url), "utf8");
const goalState = await readFile(new URL("../../src/game/state/GoalPresentationState.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../u3-goal-presentation.css", import.meta.url), "utf8");


test("main menu loads goal presentation beside match intro", () => {
  assert.match(menuFlow, /import "\.\/MatchIntroFlow\.js";/);
  assert.match(menuFlow, /import "\.\/GoalPresentationFlow\.js";/);
});


test("goal presentation observes score increases without owning gameplay", () => {
  assert.match(goalFlow, /new MutationObserver\(detectScoreChange\)/);
  assert.match(goalFlow, /nextScores\[0\] > observedScores\[0\]/);
  assert.match(goalFlow, /nextScores\[1\] > observedScores\[1\]/);
  assert.match(goalFlow, /document\.body\.dataset\.flow/);
  assert.doesNotMatch(goalFlow, /game\.score/);
  assert.doesNotMatch(goalFlow, /kickoff\(/);
});


test("goal presentation exposes goal score replay and completion stages", () => {
  assert.match(goalState, /GOAL: "goal"/);
  assert.match(goalState, /SCORE: "score"/);
  assert.match(goalState, /REPLAY: "replay"/);
  assert.match(goalState, /COMPLETE: "complete"/);
  assert.match(goalFlow, /GOAL_PRESENTATION_STATES\.GOAL/);
  assert.match(goalFlow, /GOAL_PRESENTATION_STATES\.REPLAY/);
});


test("goal card starts after native highlight and clears before native replay", () => {
  assert.match(goalFlow, /leadIn: 460, goal: 500, score: 380, replayMax: 1800/);
  assert.match(goalFlow, /timelinePhase = "native-highlight"/);
  assert.match(goalFlow, /await wait\(timings\.leadIn, token\)/);
  assert.match(goalFlow, /setVisible\(false\);\n    if \(replay\)/);
  assert.match(goalFlow, /waitForNativeReplayEnd/);
  assert.match(goalFlow, /timelinePhase = "native-replay"/);
});


test("goal presentation has deterministic visual test controls", () => {
  assert.match(goalFlow, /params\.has\("visualTest"\)/);
  assert.match(goalFlow, /params\.has\("goalTest"\)/);
  assert.match(goalFlow, /releaseTestHold/);
  assert.match(goalFlow, /window\.__TONY_GOAL_PRESENTATION__/);
});


test("goal presentation styling supports camera treatment and narrow landscape", () => {
  assert.match(css, /\.goal-presentation-overlay/);
  assert.match(css, /\.goal-presentation-card/);
  assert.match(css, /\.match-pitch\.goal-presentation-active canvas/);
  assert.match(css, /max-height: 520px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
