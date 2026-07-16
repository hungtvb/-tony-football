import assert from "node:assert/strict";
import test from "node:test";

import { createGameEvent, GameEventType } from "../../src/game/engine/GameEvents.js";
import { projectBrowserMatchPresentationEvent } from "../../src/game/presentation/BrowserMatchPresentationProjection.js";

function element() {
  const classes = new Set();
  return {
    textContent: "",
    classList: {
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
  };
}

function fixture() {
  const elements = new Map([
    ["startOverlay", element()],
    ["pauseOverlay", element()],
    ["resultOverlay", element()],
    ["matchState", element()],
    ["commentary", element()],
    ["replayBadge", element()],
  ]);
  return {
    elements,
    document: {
      getElementById(id) {
        return elements.get(id) ?? null;
      },
    },
  };
}

function event(type, payload = {}, sequence = 0) {
  return createGameEvent(type, payload, { tick: sequence + 1, sequence });
}

test("live gameplay events keep radar-adjacent status text dynamic", () => {
  const { document, elements } = fixture();
  const commentary = elements.get("commentary");

  projectBrowserMatchPresentationEvent(document, event(GameEventType.MATCH_STARTED));
  assert.equal(commentary.textContent, "TONY FC giao bóng!");
  assert.equal(elements.get("matchState").textContent, "LIVE");

  projectBrowserMatchPresentationEvent(document, event(GameEventType.POSSESSION_CHANGED, {
    previousOwnerId: null,
    ownerId: "home-4",
    reason: "control",
  }, 1));
  assert.equal(commentary.textContent, "TONY FC kiểm soát bóng.");

  projectBrowserMatchPresentationEvent(document, event(GameEventType.BALL_KICKED, {
    style: "through",
  }, 2));
  assert.equal(commentary.textContent, "Đường chọc khe mở ra khoảng trống!");
});

test("score and replay lifecycle update commentary and replay badge", () => {
  const { document, elements } = fixture();
  const commentary = elements.get("commentary");
  const replayBadge = elements.get("replayBadge");

  projectBrowserMatchPresentationEvent(document, event(GameEventType.SCORE_CHANGED, {
    team: 0,
    score: [1, 0],
  }));
  assert.equal(commentary.textContent, "GOOOOAL! TONY FC ghi bàn · 1-0");

  projectBrowserMatchPresentationEvent(document, event(GameEventType.REPLAY_STARTED, {}, 1));
  assert.equal(replayBadge.textContent, "● INSTANT REPLAY");
  assert.equal(replayBadge.classList.contains("show"), true);
  assert.equal(commentary.textContent, "Đang xem lại bàn thắng.");

  projectBrowserMatchPresentationEvent(document, event(GameEventType.REPLAY_ENDED, {}, 2));
  assert.equal(replayBadge.classList.contains("show"), false);
  assert.equal(commentary.textContent, "Chuẩn bị giao bóng lại.");
});
