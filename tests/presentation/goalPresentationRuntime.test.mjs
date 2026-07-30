import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuFlow = await readFile(new URL("../../src/game/presentation/MainMenuFlow.js", import.meta.url), "utf8");
const goalFlow = await readFile(new URL("../../src/game/presentation/GoalPresentationFlow.js", import.meta.url), "utf8");
const goalProjection = await readFile(new URL("../../src/game/presentation/GoalPresentationPhaseProjection.js", import.meta.url), "utf8");
const goalState = await readFile(new URL("../../src/game/state/GoalPresentationState.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../src/styles/goal-presentation.css", import.meta.url), "utf8");


test("main menu loads goal presentation beside match intro", () => {
  assert.match(menuFlow, /import "\.\/MatchIntroFlow\.js";/);
  assert.match(menuFlow, /import "\.\/GoalPresentationFlow\.js";/);
});


test("goal presentation consumes explicit phase events without owning gameplay", () => {
  assert.match(goalFlow, /subscribeToGameEvents\(window/);
  assert.match(goalFlow, /GameEventType\.SCORE_CHANGED/);
  assert.match(goalFlow, /GameEventType\.GOAL_PHASE_CHANGED/);
  assert.match(goalFlow, /GameEventType\.REPLAY_STARTED/);
  assert.match(goalFlow, /GameEventType\.REPLAY_ENDED/);
  assert.match(goalFlow, /applyAuthoritativePhase\(event\.payload\)/);
  assert.doesNotMatch(goalFlow, /MutationObserver/);
  assert.doesNotMatch(goalFlow, /homeScore|awayScore|replayBadge/);
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


test("authoritative phases decide card visibility and replay exposure", () => {
  assert.match(goalFlow, /projectGoalPresentationPhase\(payload\.phase\)/);
  assert.match(goalFlow, /case GoalSequencePhase\.GOAL_CARD/);
  assert.match(goalFlow, /case GoalSequencePhase\.SCORE_CARD/);
  assert.match(goalFlow, /case GoalSequencePhase\.REPLAY/);
  assert.match(goalFlow, /case GoalSequencePhase\.KICKOFF/);
  assert.match(goalProjection, /NATIVE_HIGHLIGHT/);
  assert.match(goalProjection, /visible: true,\r?\n    state: "goal"/);
  assert.match(goalProjection, /visible: false,\r?\n    state: "replay"/);
  assert.match(goalFlow, /timelineHistory: timelineHistory\.map/);
});


test("goal presentation preview controls stay isolated from authoritative event flow", () => {
  assert.match(goalFlow, /params\.has\("visualTest"\)/);
  assert.match(goalFlow, /params\.has\("goalTest"\)/);
  assert.match(goalFlow, /startPreview/);
  assert.match(goalFlow, /releaseTestHold/);
  assert.match(goalFlow, /window\.__TONY_GOAL_PRESENTATION__/);
  assert.match(goalFlow, /Object\.hasOwn\(event\.payload, "replayAvailable"\)/);
  assert.match(goalFlow, /beginAuthoritativeGoal\(\{ team: activeTeam, score: latestScore \}\)/);
});


test("goal presentation styling supports camera treatment and narrow landscape", () => {
  assert.match(css, /\.goal-presentation-overlay/);
  assert.match(css, /\.goal-presentation-card/);
  assert.match(css, /\.match-pitch\.goal-presentation-active canvas/);
  assert.match(css, /max-height: 520px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
