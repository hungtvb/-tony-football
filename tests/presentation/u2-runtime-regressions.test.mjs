import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const snapshotAdapter = await readFile(new URL("../../src/game/presentation/CompatibilitySnapshotAdapter.js", import.meta.url), "utf8");

const compactSource = source.replace(/\s+/g, "");

test("audio cooldown uses one monotonic clock domain", () => {
  assert.match(source, /function audioNow\(\) \{ return performance\.now\(\) \/ 1000; \}/);
  assert.doesNotMatch(source, /audioContext\?\.currentTime \?\?/);
});

test("replay snapshots retain ball velocity and trail", () => {
  assert.match(source, /game\.replay\.record\(snapshot, dt\)/);
  assert.match(snapshotAdapter, /"vx", "vy"/);
  assert.match(snapshotAdapter, /trail: \(ball\.trail \?\? \[\]\)\.map/);
  assert.match(compactSource, /constrenderTrail=replayFrame\?\.ball\.trail\|\|snapshot\.ball\.trail/);
  assert.doesNotMatch(compactSource, /constrenderTrail=replayFrame\?\.ball\.trail\|\|ball\.trail/);
  assert.match(compactSource, /Math\.hypot\(renderBall\.vx\|\|0,renderBall\.vy\|\|0\)/);
});

test("goal effects share the sequence duration", () => {
  assert.ok(compactSource.includes("timer:goalDuration,duration:goalDuration"));
  assert.ok(compactSource.includes("game.goalSequence.duration-game.goalSequence.timer"));
});
