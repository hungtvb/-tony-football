import assert from "node:assert/strict";
import test from "node:test";

import { createMatchSnapshot } from "../../src/game/engine/MatchSnapshot.js";
import { createRadarSnapshotAdapter } from "../../src/game/presentation/RadarSnapshotAdapter.js";
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
    stroke: () => calls.push(["stroke"]),
  };
}

function createSnapshot() {
  return createMatchSnapshot({
    tick: 2,
    match: { selectedPlayerId: "home-4" },
    players: [
      { id: "home-4", team: 0, x: 48, y: 42 },
      { id: "away-4", team: 1, x: 1152, y: 658 },
    ],
    ball: { id: "match-ball", ownerId: "home-4", x: 600, y: 350 },
  });
}

const rendererOptions = {
  width: 260,
  height: 140,
  field: { left: 48, right: 1152, top: 42, bottom: 658 },
  config: { plotPadding: 10, playerRadius: 2.7, selectedRadius: 4.8, ballRadius: 3.8 },
};

test("radar adapter claims the canvas so the legacy draw path becomes a no-op", () => {
  const context = createFakeContext();
  const canvas = { width: 260, height: 140, getContext: () => context };
  const adapter = createRadarSnapshotAdapter({
    document: { getElementById: (id) => id === "radarCanvas" ? canvas : null },
  });
  const snapshot = createSnapshot();

  assert.equal(adapter.render({ snapshot }), false);
  assert.deepEqual(context.calls, []);
  assert.equal(adapter.attach(), true);
  assert.equal(renderRadarSnapshot(context, snapshot, rendererOptions), false);
  assert.deepEqual(context.calls, []);

  assert.equal(adapter.render({ snapshot }), true);
  assert.equal(context.calls.filter(([name]) => name === "clearRect").length, 1);
  assert.equal(context.calls.filter(([name]) => name === "arc").length, 5);

  assert.equal(adapter.teardown(), true);
  context.calls.length = 0;
  assert.equal(renderRadarSnapshot(context, snapshot, rendererOptions), true);
  assert.equal(context.calls.filter(([name]) => name === "clearRect").length, 1);
});

test("radar adapter reset clears its canvas and missing canvas remains safe", () => {
  const context = createFakeContext();
  const canvas = { width: 260, height: 140, getContext: () => context };
  const adapter = createRadarSnapshotAdapter({
    document: { getElementById: () => canvas },
  });
  assert.equal(adapter.attach(), true);
  assert.equal(adapter.reset(), true);
  assert.deepEqual(context.calls.at(-1), ["clearRect", 0, 0, 260, 140]);
  assert.equal(adapter.teardown(), true);

  const missing = createRadarSnapshotAdapter({
    document: { getElementById: () => null },
  });
  assert.equal(missing.attach(), false);
  assert.equal(missing.render({ snapshot: createSnapshot() }), false);
  assert.equal(missing.reset(), false);
  assert.equal(missing.teardown(), false);
});

test("radar context cannot be claimed by two live adapters", () => {
  const context = createFakeContext();
  const canvas = { width: 260, height: 140, getContext: () => context };
  const document = { getElementById: () => canvas };
  const first = createRadarSnapshotAdapter({ document });
  const second = createRadarSnapshotAdapter({ document });

  assert.equal(first.attach(), true);
  assert.throws(() => second.attach(), /already owned/);
  assert.equal(first.teardown(), true);
  assert.equal(second.attach(), true);
  assert.equal(second.teardown(), true);
});
