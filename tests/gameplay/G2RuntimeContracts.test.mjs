import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../game.js", import.meta.url), "utf8");

function functionBody(name, nextName) {
  const start = source.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? source.indexOf(`  function ${nextName}(`, start + 1) : source.length;
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`);
  return source.slice(start, end);
}

test("kickoff resets transient locomotion state", () => {
  const kickoff = functionBody("kickoff", "startMatch");
  assert.match(kickoff, /player\.vx\s*=\s*player\.vy\s*=\s*0/);
  assert.match(kickoff, /player\.sprinting\s*=\s*false/);
  assert.match(kickoff, /player\.controlBoost\s*=\s*0/);
  assert.match(kickoff, /player\.turnLean\s*=\s*0/);
  assert.match(kickoff, /player\.strideBlend\s*=\s*0/);
});

test("pause and resume do not mutate player locomotion", () => {
  const togglePause = functionBody("togglePause", "endMatch");
  assert.doesNotMatch(togglePause, /player\.(?:vx|vy|dirX|dirY|sprinting|stamina|controlBoost)/);
  assert.match(togglePause, /game\.state\s*=\s*pause\s*\?\s*"paused"\s*:\s*"playing"/);
});

test("player switching changes selection without copying locomotion state", () => {
  const switchPlayer = functionBody("switchPlayer", "switchPlayerInDirection");
  const directionalSwitch = functionBody("switchPlayerInDirection", "setOwner");
  for (const body of [switchPlayer, directionalSwitch]) {
    assert.doesNotMatch(body, /game\.selected\.(?:vx|vy|dirX|dirY|sprinting|stamina)\s*=/);
  }
});

test("exhausted players cannot remain sprinting", () => {
  const updateUser = functionBody("updateUser", "updateAI");
  assert.match(updateUser, /player\.stamina\s*>\s*controlledLocomotion\.sprintStaminaThreshold/);
  assert.match(updateUser, /player\.sprinting\s*=\s*canSprint\s*&&\s*hasMove/);
});
