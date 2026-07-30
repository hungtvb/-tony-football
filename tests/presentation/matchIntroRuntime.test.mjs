import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuFlow = await readFile(new URL("../../src/game/presentation/MainMenuFlow.js", import.meta.url), "utf8");
const introFlow = await readFile(new URL("../../src/game/presentation/MatchIntroFlow.js", import.meta.url), "utf8");
const introState = await readFile(new URL("../../src/game/state/MatchPresentationState.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../src/styles/match-intro.css", import.meta.url), "utf8");

test("main menu loads the match intro presentation before its own bindings", () => {
  assert.match(menuFlow, /^import "\.\/MatchIntroFlow\.js";/);
});

test("match intro intercepts only the initial start action", () => {
  assert.match(introFlow, /closest\("#playButton"\)/);
  assert.match(introFlow, /event\.stopImmediatePropagation\(\)/);
  assert.match(introFlow, /requestApplicationAction\(window, ApplicationActionType\.START_MATCH\)/);
  assert.doesNotMatch(introFlow, /playButton\?\.click\(\)/);
  assert.doesNotMatch(introFlow, /closest\("#restartButton"\)/);
});

test("match intro exposes versus countdown kickoff and completion stages", () => {
  assert.match(introState, /VERSUS: "versus"/);
  assert.match(introState, /COUNTDOWN: "countdown"/);
  assert.match(introState, /KICKOFF: "kickoff"/);
  assert.match(introState, /COMPLETE: "complete"/);
  assert.match(introFlow, /\["3", "2", "1"\]/);
  assert.match(introFlow, /setCountdown\("KICK OFF"\)/);
});

test("intro reflects active match setup choices", () => {
  assert.match(introFlow, /\[data-difficulty\]/);
  assert.match(introFlow, /\[data-pitch\]/);
  assert.match(introFlow, /\[data-ball\]/);
  assert.match(introFlow, /\[data-weather\]/);
  assert.match(introFlow, /introDifficulty/);
  assert.match(introFlow, /introWeather/);
});

test("visual tests use accelerated deterministic intro timing", () => {
  assert.match(introFlow, /params\.has\("visualTest"\)/);
  assert.match(introFlow, /\{ versus: 520, countdown: 220, kickoff: 300 \}/);
  assert.match(introFlow, /params\.has\("skipIntro"\)/);
  assert.match(introFlow, /window\.__TONY_MATCH_INTRO__/);
});

test("intro styling provides presentation camera and reduced-motion hooks", () => {
  assert.match(css, /\.match-intro-overlay/);
  assert.match(css, /\.intro-versus-stage/);
  assert.match(css, /\.intro-countdown-stage/);
  assert.match(css, /\.match-pitch\.intro-camera-active canvas/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
