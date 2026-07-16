import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { renderRadarSnapshot } from "../../src/game/presentation/RadarSnapshotRenderer.js";

function createFakeContext() {
  const calls = [];
  return {
    calls,
    clearRect: (...args) => calls.push(["clearRect", ...args]),
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    strokeRect: (...args) => calls.push(["strokeRect", ...args]),
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    arc: (...args) => calls.push(["arc", ...args]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"])
  };
}

test("radar renderer maps immutable snapshot markers and selected identity to pitch bounds", () => {
  const snapshot = createMatchSnapshot({
    tick: 1,
    match: { selectedPlayerId: "home-4" },
    players: [
      { id: "home-4", team: 0, x: 48, y: 42 },
      { id: "away-4", team: 1, x: 1152, y: 658 }
    ],
    ball: { id: "match-ball", ownerId: "home-4", x: 600, y: 350 }
  });
  const context = createFakeContext();
  const config = { plotPadding: 8, playerRadius: 3, selectedRadius: 4, ballRadius: 2.5 };

  renderRadarSnapshot(context, snapshot, {
    width: 200,
    height: 100,
    field: { left: 48, right: 1152, top: 42, bottom: 658 },
    config
  });

  const arcs = context.calls.filter(([name]) => name === "arc");
  assert.deepEqual(arcs[1].slice(1, 4), [8, 8, 4]);
  assert.deepEqual(arcs[2].slice(1, 4), [8, 8, 6.2]);
  assert.deepEqual(arcs[3].slice(1, 4), [192, 92, 3]);
  assert.deepEqual(arcs.at(-1).slice(1, 4), [100, 50, 2.5]);
  assert.ok(context.calls.every(([name]) => name !== "fillText"));
});
