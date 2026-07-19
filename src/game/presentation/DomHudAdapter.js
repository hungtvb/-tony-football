import { createHudSnapshotProjection } from "./HudSnapshotProjection.js";

const HOME = 0;
const AWAY = 1;
const PLAYER_CHANGE_MILLISECONDS = 320;
const SCORE_POP_MILLISECONDS = 420;

function requireDocument(document) {
  if (!document || typeof document.getElementById !== "function") {
    throw new TypeError("DomHudAdapter requires a document");
  }
}

function setText(element, value) {
  if (element) element.textContent = String(value);
}

function setClass(element, name, active) {
  element?.classList?.toggle?.(name, Boolean(active));
}

function queryAll(document, selector) {
  if (typeof document.querySelectorAll !== "function") return [];
  return [...document.querySelectorAll(selector)];
}

function queryOne(document, selector) {
  if (typeof document.querySelector !== "function") return null;
  return document.querySelector(selector);
}

export function createDomHudAdapter({
  document,
  schedule = globalThis.setTimeout?.bind(globalThis),
  cancel = globalThis.clearTimeout?.bind(globalThis),
} = {}) {
  requireDocument(document);
  if (typeof schedule !== "function" || typeof cancel !== "function") {
    throw new TypeError("DomHudAdapter requires timer functions");
  }

  const elements = Object.freeze({
    homeScore: document.getElementById("homeScore"),
    awayScore: document.getElementById("awayScore"),
    gameClock: document.getElementById("gameClock"),
    staminaBar: document.getElementById("staminaBar"),
    staminaText: document.getElementById("staminaText"),
    playerName: document.getElementById("playerName"),
    playerNumber: document.getElementById("playerNumber"),
    playerRating: document.getElementById("playerRating"),
    possessionStat: document.getElementById("possessionStat"),
    possessionBar: document.getElementById("possessionBar"),
    homeShots: document.getElementById("homeShots"),
    awayShots: document.getElementById("awayShots"),
    passStat: document.getElementById("passStat"),
    controlsMode: document.getElementById("controlsMode"),
    controlsCard: document.getElementById("controlsCard"),
    playerCard: queryOne(document, ".hud-player-card"),
    controlLabels: Object.freeze(queryAll(document, "[data-attack][data-defense]")),
  });

  const timers = new Set();
  let selectedPlayerId = null;
  let renderedScore = null;

  function clearTimers() {
    for (const timer of timers) cancel(timer);
    timers.clear();
  }

  function flashClass(element, className, duration) {
    if (!element?.classList) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    let timer = null;
    timer = schedule(() => {
      if (timer !== null) timers.delete(timer);
      element.classList.remove(className);
    }, duration);
    timers.add(timer);
  }

  function renderPlayer(player) {
    if (!player) return;
    if (selectedPlayerId !== null && selectedPlayerId !== player.id) {
      flashClass(elements.playerCard, "player-change", PLAYER_CHANGE_MILLISECONDS);
    }
    selectedPlayerId = player.id;
    setText(elements.playerName, player.name);
    setText(elements.playerNumber, player.number);
    setText(elements.playerRating, player.rating);
    if (elements.staminaBar?.style) elements.staminaBar.style.width = `${player.stamina}%`;
    setText(elements.staminaText, `${Math.round(player.stamina)}%`);

    const lowStamina = player.stamina < 25;
    setClass(elements.playerCard, "low-stamina", lowStamina);
    if (elements.staminaBar?.style) {
      elements.staminaBar.style.background = lowStamina
        ? "linear-gradient(90deg,#b63f35,#ff8c78)"
        : "linear-gradient(90deg,#b78a2f,#ffdc78)";
    }
  }

  function renderScore(score) {
    setText(elements.homeScore, score[HOME]);
    setText(elements.awayScore, score[AWAY]);

    if (renderedScore) {
      if (score[HOME] !== renderedScore[HOME]) {
        flashClass(elements.homeScore, "score-pop", SCORE_POP_MILLISECONDS);
      }
      if (score[AWAY] !== renderedScore[AWAY]) {
        flashClass(elements.awayScore, "score-pop", SCORE_POP_MILLISECONDS);
      }
    }
    renderedScore = [...score];
  }

  function renderControlMode(controlMode) {
    const mode = controlMode === "attack" ? "attack" : "defense";
    if (elements.controlsMode?.dataset?.mode === mode) return;

    if (elements.controlsMode?.dataset) elements.controlsMode.dataset.mode = mode;
    setText(elements.controlsMode, mode === "attack" ? "TẤN CÔNG" : "PHÒNG THỦ");
    setClass(elements.controlsCard, "defense", mode === "defense");
    for (const label of elements.controlLabels) {
      const value = label.dataset?.[mode];
      if (value !== undefined) setText(label, value);
    }
  }

  function reset() {
    clearTimers();
    selectedPlayerId = null;
    renderedScore = null;
    elements.playerCard?.classList?.remove?.("player-change");
    elements.playerCard?.classList?.remove?.("low-stamina");
    elements.homeScore?.classList?.remove?.("score-pop");
    elements.awayScore?.classList?.remove?.("score-pop");
    return true;
  }

  return Object.freeze({
    render(frame = {}) {
      const { snapshot } = frame;
      const hud = createHudSnapshotProjection(snapshot);

      setText(elements.gameClock, hud.clock);
      renderScore(hud.score);
      renderPlayer(hud.selectedPlayer);

      const hintsActive = Boolean(frame.hasActiveInput || hud.state !== "playing");
      setClass(elements.controlsCard, "hints-dimmed", hud.elapsed > 18 && !hintsActive);
      setClass(elements.controlsCard, "hints-active", hintsActive);

      setText(elements.possessionStat, `${hud.homePossession}%`);
      if (elements.possessionBar?.style) elements.possessionBar.style.width = `${hud.homePossession}%`;
      setText(elements.homeShots, hud.shots[HOME]);
      setText(elements.awayShots, hud.shots[AWAY]);
      setText(elements.passStat, `${hud.passAccuracy}%`);
      renderControlMode(frame.controlMode);

      return hud;
    },

    reset,

    teardown() {
      return reset();
    },
  });
}
