import "./MatchIntroFlow.js";
import "./GoalPresentationFlow.js";
import "./PostMatchHub.js";
import { ApplicationActionType } from "../application/ApplicationActions.js";
import { APPLICATION_HANDLED_EVENT } from "../application/BrowserApplicationAdapter.js";

const mainMenu = document.getElementById("mainMenuOverlay");
const matchSetup = document.getElementById("startOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const resultOverlay = document.getElementById("resultOverlay");
const quickMatchButton = document.getElementById("quickMatchButton");
const playButton = document.getElementById("playButton");

function setOverlayVisible(element, visible) {
  if (!element) return;
  element.classList.toggle("show", visible);
  element.setAttribute("aria-hidden", String(!visible));
}

export function showMainMenuView({ focus = true } = {}) {
  setOverlayVisible(mainMenu, true);
  setOverlayVisible(matchSetup, false);
  setOverlayVisible(pauseOverlay, false);
  setOverlayVisible(resultOverlay, false);
  document.body.dataset.flow = "main-menu";
  if (focus) queueMicrotask(() => quickMatchButton?.focus());
}

export function showMatchSetupView({ focus = true } = {}) {
  setOverlayVisible(mainMenu, false);
  setOverlayVisible(matchSetup, true);
  setOverlayVisible(pauseOverlay, false);
  setOverlayVisible(resultOverlay, false);
  document.body.dataset.flow = "match-setup";
  if (focus) queueMicrotask(() => playButton?.focus());
}

function markMatchActive() {
  setOverlayVisible(mainMenu, false);
  document.body.dataset.flow = "match";
}

window.addEventListener(APPLICATION_HANDLED_EVENT, (event) => {
  const type = event.detail?.type;
  if (type === ApplicationActionType.OPEN_MATCH_SETUP) showMatchSetupView();
  else if (type === ApplicationActionType.OPEN_MAIN_MENU) showMainMenuView();
  else if (
    type === ApplicationActionType.START_MATCH
    || type === ApplicationActionType.RESTART_MATCH
  ) markMatchActive();
});

const debugScenario = new URLSearchParams(window.location.search).get("debugScenario");
if (debugScenario) {
  setOverlayVisible(mainMenu, false);
  setOverlayVisible(matchSetup, false);
  document.body.dataset.flow = "match";
} else {
  showMainMenuView({ focus: false });
}
