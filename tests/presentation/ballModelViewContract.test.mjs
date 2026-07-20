import assert from "node:assert/strict";
import test from "node:test";

import {
  BALL_MODEL_STYLES,
  projectChargeIndicator,
  resolveBallModelStyle,
} from "../../src/game/presentation/BallModelView.js";

test("ball style selection is deterministic and falls back safely", () => {
  assert.equal(resolveBallModelStyle("volt"), BALL_MODEL_STYLES.volt);
  assert.equal(resolveBallModelStyle("missing"), BALL_MODEL_STYLES.classic);
  assert.ok(Object.isFrozen(resolveBallModelStyle("classic")));
});

test("charge projection is read-only and visible only for the selected owner", () => {
  const player = Object.freeze({ id: "home-0", x: 100, y: 200 });
  const activeCharge = Object.freeze({ power: 0.9 });
  const visible = projectChargeIndicator({
    activeCharge,
    selectedPlayer: player,
    ballOwnerId: "home-0",
  });
  assert.deepEqual(visible, { visible: true, power: 0.9, urgent: true });
  assert.ok(Object.isFrozen(visible));
  assert.deepEqual(projectChargeIndicator({
    activeCharge,
    selectedPlayer: player,
    ballOwnerId: "away-0",
  }), { visible: false, power: 0, urgent: false });
});
