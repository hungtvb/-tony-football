import assert from "node:assert/strict";
import test from "node:test";

import {
  beginReceiving,
  controlPossession,
  createPossessionLifecycle,
  possessionStates,
  releasePossession,
  resetPossessionLifecycle,
  settleLoose,
} from "../../src/game/gameplay/PossessionLifecycle.js";

test("possession starts loose without owner metadata", () => {
  const state = createPossessionLifecycle();
  assert.equal(state.state, possessionStates.loose);
  assert.equal(state.ownerId, null);
  assert.equal(state.receiverId, null);
});

test("receiving records a single candidate without assigning ownership", () => {
  const state = beginReceiving(createPossessionLifecycle(), 4);
  assert.equal(state.state, possessionStates.receiving);
  assert.equal(state.receiverId, 4);
  assert.equal(state.ownerId, null);
});

test("controlled possession records owner and touch outcome", () => {
  const state = controlPossession(beginReceiving(createPossessionLifecycle(), 4), 4, "cushioned");
  assert.equal(state.state, possessionStates.controlled);
  assert.equal(state.ownerId, 4);
  assert.equal(state.lastControllerId, 4);
  assert.equal(state.receiverId, null);
  assert.equal(state.touchOutcome, "cushioned");
});

test("release clears owner and preserves release reason", () => {
  const controlled = controlPossession(createPossessionLifecycle(), 7);
  const released = releasePossession(controlled, "shot");
  assert.equal(released.state, possessionStates.released);
  assert.equal(released.ownerId, null);
  assert.equal(released.lastControllerId, 7);
  assert.equal(released.releaseReason, "shot");
});

test("released possession settles to loose without losing transition metadata", () => {
  const released = releasePossession(controlPossession(createPossessionLifecycle(), 2), "tackle");
  const loose = settleLoose(released);
  assert.equal(loose.state, possessionStates.loose);
  assert.equal(loose.releaseReason, "tackle");
  assert.equal(loose.lastControllerId, 2);
});

test("kickoff reset clears lifecycle metadata", () => {
  const state = releasePossession(controlPossession(createPossessionLifecycle(), 5), "pass");
  assert.deepEqual(resetPossessionLifecycle(state), createPossessionLifecycle());
});
