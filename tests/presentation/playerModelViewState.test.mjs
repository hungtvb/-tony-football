import assert from "node:assert/strict";
import test from "node:test";
import { selectPlayerAnimationState } from "../../src/game/presentation/PlayerModelView.js";
const player = (anim = "idle") => Object.freeze({ id: "home-1", anim });
test("player animation selection is a pure projection of immutable render facts", () => {
  assert.equal(selectPlayerAnimationState(player("celebrate"), 0), "Dance_Loop");
  assert.equal(selectPlayerAnimationState(player("dive"), 0), "Roll");
  assert.equal(selectPlayerAnimationState(player("tackle"), 240), "Idle_Loop");
  assert.equal(selectPlayerAnimationState(player("idle"), 240), "Sprint_Loop");
  assert.equal(selectPlayerAnimationState(player("idle"), 190, "Sprint_Loop"), "Sprint_Loop");
  assert.equal(selectPlayerAnimationState(player("idle"), 80), "Jog_Fwd_Loop");
  assert.equal(selectPlayerAnimationState(player("idle"), 20), "Idle_Loop");
});
test("player animation selection rejects mutable gameplay objects", () => {
  assert.throws(() => selectPlayerAnimationState({ id: "home-1", anim: "idle" }, 0), /immutable/);
});
