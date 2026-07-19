import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { classifyTon80GameSource, prepareTon80Game } from "../../scripts/prepare-ton80-game.mjs";

const legacySource = [
  "new THREE.WebGLRenderer",
  "new EffectComposer(",
  "new RoomEnvironment(",
].join("\n");

const preparedSource = [
  "let threeScenePort = null;",
  "onPresentationReady: init3D,",
  "window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.()",
].join("\n");

function workspace(source) {
  const cwd = mkdtempSync(join(tmpdir(), "ton80-prepare-"));
  writeFileSync(join(cwd, "game.js"), source);
  return cwd;
}

test("classifies legacy, prepared and partial TON-80 sources", () => {
  assert.equal(classifyTon80GameSource(legacySource), "legacy");
  assert.equal(classifyTon80GameSource(preparedSource), "prepared");
  assert.equal(classifyTon80GameSource(`${legacySource}\nlet threeScenePort = null;`), "inconsistent");
});

test("prepared artifacts are idempotent and do not invoke migration commands", () => {
  const cwd = workspace(preparedSource);
  const calls = [];
  const result = prepareTon80Game({ cwd, run: (...args) => calls.push(args) });
  assert.deepEqual(result, { state: "prepared", changed: false });
  assert.deepEqual(calls, []);
});

test("legacy artifacts run migration and normalization exactly once", () => {
  const cwd = workspace(legacySource);
  const calls = [];
  const result = prepareTon80Game({
    cwd,
    run: (command, args) => {
      calls.push([command, args]);
      if (calls.length === 1) writeFileSync(join(cwd, "game.js"), preparedSource);
      return { status: 0 };
    },
  });
  assert.deepEqual(result, { state: "prepared", changed: true });
  assert.equal(calls.length, 2);
  assert.equal(readFileSync(join(cwd, "game.js"), "utf8"), preparedSource);
});

test("partial migration fails closed before executing commands", () => {
  const cwd = workspace(`${legacySource}\nlet threeScenePort = null;`);
  assert.throws(
    () => prepareTon80Game({ cwd, run: () => ({ status: 0 }) }),
    /partially migrated/,
  );
});
