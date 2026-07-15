import "./MatchIntroFlow.js";

const mainMenu = document.getElementById("mainMenuOverlay");
const matchSetup = document.getElementById("startOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const resultOverlay = document.getElementById("resultOverlay");
const quickMatchButton = document.getElementById("quickMatchButton");
const setupBackButton = document.getElementById("setupBackButton");
const setupButton = document.getElementById("setupButton");
const mainMenuButton = document.getElementById("mainMenuButton");
const playButton = document.getElementById("playButton");
const restartButton = document.getElementById("restartButton");
const playAgainButton = document.getElementById("playAgainButton");

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

quickMatchButton?.addEventListener("click", () => showMatchSetupView());
setupBackButton?.addEventListener("click", () => showMainMenuView());

// game.js owns the simulation reset. These listeners run after its handlers and
// only decide which presentation surface remains visible.
setupButton?.addEventListener("click", () => queueMicrotask(() => showMatchSetupView()));
mainMenuButton?.addEventListener("click", () => queueMicrotask(() => showMainMenuView()));
playButton?.addEventListener("click", markMatchActive);
restartButton?.addEventListener("click", markMatchActive);
playAgainButton?.addEventListener("click", markMatchActive);

const debugScenario = new URLSearchParams(window.location.search).get("debugScenario");
if (debugScenario) {
  setOverlayVisible(mainMenu, false);
  setOverlayVisible(matchSetup, false);
  document.body.dataset.flow = "match";
} else {
  showMainMenuView({ focus: false });
}
