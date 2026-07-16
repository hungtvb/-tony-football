import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const game = await readFile(new URL("../../game.js", import.meta.url), "utf8");
const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const menuFlow = await readFile(new URL("../../src/game/presentation/MainMenuFlow.js", import.meta.url), "utf8");
const browserApplication = await readFile(new URL("../../src/game/application/BrowserApplicationAdapter.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../u3-match-flow.css", import.meta.url), "utf8");

test("pause menu exposes setup and main menu navigation", () => {
  assert.match(index, /id="setupButton"/);
  assert.match(index, /id="mainMenuButton"/);
  assert.match(index, /u3-match-flow\.css/);
});

test("runtime has explicit simulation-safe menu transition functions", () => {
  assert.match(game, /function clearActiveInput\(\)/);
  assert.match(game, /function showMatchSetup\(/);
  assert.match(game, /function showMainMenu\(\)/);
  assert.match(game, /game\.state = "menu"/);
  assert.match(game, /ui\.start\.classList\.add\("show"\)/);
});

test("main menu and match setup are separate presentation surfaces", () => {
  assert.match(index, /id="mainMenuOverlay"[^>]*class="[^"]*show/);
  assert.match(index, /id="startOverlay" class="game-overlay pre-match-overlay"/);
  assert.match(index, /id="quickMatchButton"/);
  assert.match(index, /id="setupBackButton"/);
  assert.match(index, /MainMenuFlow\.js/);
  assert.match(css, /\.main-menu-card/);
});

test("main menu flow toggles overlays instead of aliasing setup", () => {
  assert.match(menuFlow, /function showMainMenuView/);
  assert.match(menuFlow, /function showMatchSetupView/);
  assert.match(menuFlow, /setOverlayVisible\(mainMenu, true\)/);
  assert.match(menuFlow, /setOverlayVisible\(matchSetup, false\)/);
  assert.match(menuFlow, /setOverlayVisible\(mainMenu, false\)/);
  assert.match(menuFlow, /setOverlayVisible\(matchSetup, true\)/);
  assert.match(menuFlow, /document\.body\.dataset\.flow = "main-menu"/);
  assert.match(menuFlow, /document\.body\.dataset\.flow = "match-setup"/);
});

test("pause navigation buttons are wired", () => {
  assert.match(browserApplication, /setupButton: ApplicationActionType\.OPEN_MATCH_SETUP/);
  assert.match(browserApplication, /mainMenuButton: ApplicationActionType\.OPEN_MAIN_MENU/);
  assert.match(menuFlow, /APPLICATION_HANDLED_EVENT/);
  assert.match(menuFlow, /ApplicationActionType\.OPEN_MATCH_SETUP/);
  assert.match(menuFlow, /ApplicationActionType\.OPEN_MAIN_MENU/);
});

test("debug scenarios bypass menu overlays for visual validation", () => {
  assert.match(menuFlow, /get\("debugScenario"\)/);
  assert.match(menuFlow, /if \(debugScenario\)/);
  assert.match(menuFlow, /setOverlayVisible\(mainMenu, false\)/);
  assert.match(menuFlow, /setOverlayVisible\(matchSetup, false\)/);
});
