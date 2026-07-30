import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("CSS uses one ordered static entry and presentation-owned lazy styles", async () => {
  const [index, app, intro, goal, post] = await Promise.all([
    read("index.html"),
    read("src/styles/app.css"),
    read("src/game/presentation/MatchIntroFlow.js"),
    read("src/game/presentation/GoalPresentationFlow.js"),
    read("src/game/presentation/PostMatchHub.js"),
  ]);

  assert.deepEqual(
    [...app.matchAll(/@import url\("\.\/(.+?\.css)"\);/g)].map((match) => match[1]),
    ["tokens.css", "foundation.css", "match.css", "match-flow.css"],
  );
  assert.deepEqual(
    [...index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]),
    ["src/styles/app.css"],
  );
  assert.match(intro, /new URL\("\.\.\/\.\.\/styles\/match-intro\.css", import\.meta\.url\)/);
  assert.match(goal, /new URL\("\.\.\/\.\.\/styles\/goal-presentation\.css", import\.meta\.url\)/);
  assert.match(post, /new URL\("\.\.\/\.\.\/styles\/post-match\.css", import\.meta\.url\)/);
});

test("production styles no longer live at repository root", async () => {
  for (const path of [
    "style.css",
    "u1-match-experience.css",
    "u3-camera-hud.css",
    "u3-match-flow.css",
    "u3-match-intro.css",
    "u3-goal-presentation.css",
    "u3-post-match.css",
    "css/style.css",
  ]) {
    await assert.rejects(access(new URL(path, root)));
  }
});
