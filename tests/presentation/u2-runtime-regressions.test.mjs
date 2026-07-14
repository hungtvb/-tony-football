import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../game.js", import.meta.url), "utf8");

test("audio cooldown uses one monotonic clock domain", () => {
  assert.match(source, /function audioNow\(\) \{ return performance\.now\(\) \/ 1000; \}/);
  assert.doesNotMatch(source, /audioContext\?\.currentTime \?\?/);
});

test("replay snapshots retain ball velocity and trail", () => {
  assert.match(source, /vx: ball\.vx, vy: ball\.vy/);
  assert.match(source, /trail: ball\.trail\.map/);
  assert.match(source, /const renderTrail=replayFrame\?\.ball\.trail\|\|ball\.trail/);
  assert.match(source, /Math\.hypot\(renderBall\.vx\|\|0,renderBall\.vy\|\|0\)/);
});

test("goal effects share the sequence duration", () => {
  assert.ok(source.includes("timer: goalDuration, duration: goalDuration"));
  assert.ok(source.includes("game.goalSequence.duration-game.goalSequence.timer"));
});
