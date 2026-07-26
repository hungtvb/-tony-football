import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);
async function read(path) { return readFile(new URL(path, rootUrl), "utf8"); }

function functionBody(source, name) {
  const signature = `function ${name}(`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  assert.fail(`${name} body is not balanced`);
}

test("engine browser step never invokes legacy gameplay progression", async () => {
  const [game, bootstrap, snapshotAdapter] = await Promise.all([
    read("game.js"),
    read("src/game/application/BrowserBootstrapComposition.js"),
    read("src/game/presentation/CompatibilitySnapshotAdapter.js"),
  ]);

  const step = functionBody(game, "simulationStep");
  assert.match(step, /updatePresentation\(dt\)/);
  assert.doesNotMatch(step, /updateLegacyGameplay\(|(?:^|\s)update\(dt\)/);
  const presentation = functionBody(game, "updatePresentation");
  assert.doesNotMatch(presentation, /updateLegacyReplay\(|updateReplay\(/);
  assert.match(game, /function updateLegacyGameplay\(dt\)/);
  assert.match(game, /function updateLegacyReplay\(\)/);
  assert.match(game, /legacyGameplayStepCount \+= 1/);
  assert.doesNotMatch(snapshotAdapter, /replay\.(?:update|syncElapsed)\(/);
  assert.doesNotMatch(game, /dispatchCompatibilityCommand:\s*applyCompatibilityCommand/);
  assert.doesNotMatch(bootstrap, /dispatchCompatibilityCommand/);
  assert.match(bootstrap, /onCommand:\s*\(\) => false/);
});
