import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("pause menu exposes setup and main menu navigation", () => {
  assert.match(index, /id="setupButton"/);
  assert.match(index, /id="mainMenuButton"/);
  assert.match(index, /u3-match-flow\.css/);
});

test("runtime has explicit menu transition functions", () => {
  assert.match(game, /function clearActiveInput\(\)/);
  assert.match(game, /function showMatchSetup\(/);
  assert.match(game, /function showMainMenu\(\)/);
  assert.match(game, /game\.state = "menu"/);
  assert.match(game, /ui\.start\.classList\.add\("show"\)/);
});

test("pause navigation buttons are wired", () => {
  assert.match(game, /\$\("setupButton"\)\.addEventListener/);
  assert.match(game, /\$\("mainMenuButton"\)\.addEventListener/);
});
