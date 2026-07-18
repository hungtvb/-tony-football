import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createDomHudAdapter } from "../../src/game/presentation/DomHudAdapter.js";

function element(dataset = {}) {
  return {
    textContent: "",
    dataset: { ...dataset },
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    offsetWidth: 1,
  };
}

test("DOM HUD uses the correct Vietnamese defense label", () => {
  const controlsMode = element({ mode: "attack" });
  const controlsCard = element();
  const controlLabel = element({ attack: "Sút", defense: "Soạc" });
  const elements = { controlsMode, controlsCard };
  const document = {
    getElementById: (id) => elements[id] ?? element(),
    querySelector: () => element(),
    querySelectorAll: () => [controlLabel],
  };
  const snapshot = createMatchSnapshot({
    tick: 1,
    match: {
      state: "playing",
      elapsed: 0,
      matchSeconds: 150,
      score: [0, 0],
      selectedPlayerId: "home-0",
      stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
    },
    players: [{ id: "home-0", team: 0, name: "TONY", number: 10, rating: 92, stamina: 100 }],
    ball: { id: "match-ball", ownerId: "home-0", x: 600, y: 350 },
  });

  const adapter = createDomHudAdapter({ document, schedule: () => 1, cancel: () => {} });
  adapter.render({ snapshot, controlMode: "defense" });

  assert.equal(controlsMode.textContent, "PHÒNG THỦ");
  assert.equal(controlLabel.textContent, "Soạc");
});
