import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createDomHudAdapter } from "../../src/game/presentation/DomHudAdapter.js";

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle: (name, active) => active ? values.add(name) : values.delete(name),
    contains: (name) => values.has(name),
  };
}

function createElement(dataset = {}) {
  return {
    textContent: "",
    dataset: { ...dataset },
    style: {},
    classList: createClassList(),
    offsetWidth: 1,
  };
}

function createDocument() {
  const ids = [
    "homeScore", "awayScore", "gameClock", "staminaBar", "staminaText",
    "playerName", "playerNumber", "playerRating", "possessionStat",
    "possessionBar", "homeShots", "awayShots", "passStat", "controlsMode",
    "controlsCard",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElement()]));
  const playerCard = createElement();
  const controlLabel = createElement({ attack: "Sút", defense: "Soạc" });
  return {
    elements,
    playerCard,
    controlLabel,
    getElementById: (id) => elements[id] ?? null,
    querySelector: (selector) => selector === ".hud-player-card" ? playerCard : null,
    querySelectorAll: (selector) => selector === "[data-attack][data-defense]" ? [controlLabel] : [],
  };
}

function createSnapshot({ score = [1, 0], stamina = 80 } = {}) {
  return createMatchSnapshot({
    tick: 4,
    match: {
      state: "playing",
      elapsed: 12,
      matchSeconds: 150,
      score,
      selectedPlayerId: "home-0",
      stats: { possession: [7, 3], shots: [2, 1], passes: 5, completed: 4 },
    },
    players: [{ id: "home-0", team: 0, name: "TONY", number: 10, rating: 92, stamina }],
    ball: { id: "match-ball", ownerId: "home-0", x: 600, y: 350 },
  });
}

test("DOM HUD adapter projects immutable snapshot facts without simulation objects", () => {
  const document = createDocument();
  const adapter = createDomHudAdapter({
    document,
    schedule: () => 1,
    cancel: () => {},
  });

  const hud = adapter.render({
    snapshot: createSnapshot(),
    controlMode: "attack",
    hasActiveInput: false,
  });

  assert.equal(document.elements.homeScore.textContent, "1");
  assert.equal(document.elements.awayScore.textContent, "0");
  assert.equal(document.elements.gameClock.textContent, "07:12");
  assert.equal(document.elements.playerName.textContent, "TONY");
  assert.equal(document.elements.staminaText.textContent, "80%");
  assert.equal(document.elements.possessionStat.textContent, "70%");
  assert.equal(document.elements.passStat.textContent, "80%");
  assert.equal(document.elements.controlsMode.textContent, "TẤN CÔNG");
  assert.equal(document.controlLabel.textContent, "Sút");
  assert.equal(Object.isFrozen(hud), true);
});

test("DOM HUD adapter owns score/player transient classes and clears them on reset", () => {
  const document = createDocument();
  let nextTimer = 0;
  const adapter = createDomHudAdapter({
    document,
    schedule: () => ++nextTimer,
    cancel: () => {},
  });

  adapter.render({ snapshot: createSnapshot(), controlMode: "attack" });
  adapter.render({ snapshot: createSnapshot({ score: [2, 0], stamina: 20 }), controlMode: "defense" });

  assert.equal(document.elements.homeScore.classList.contains("score-pop"), true);
  assert.equal(document.playerCard.classList.contains("low-stamina"), true);
  assert.equal(document.elements.controlsCard.classList.contains("defense"), true);

  adapter.reset();
  assert.equal(document.elements.homeScore.classList.contains("score-pop"), false);
  assert.equal(document.playerCard.classList.contains("low-stamina"), false);
});
