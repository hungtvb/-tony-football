import assert from "node:assert/strict";
import test from "node:test";

import { selectPlayerRigAnimation } from "../../src/game/presentation/PlayerModelView.js";

function pose(anim = "idle") {
  return Object.freeze({ anim });
}

test("player rig animation selection preserves locomotion hysteresis", () => {
  assert.equal(selectPlayerRigAnimation(pose(), 0, ""), "Idle_Loop");
  assert.equal(selectPlayerRigAnimation(pose(), 40, ""), "Jog_Fwd_Loop");
  assert.equal(selectPlayerRigAnimation(pose(), 20, "Jog_Fwd_Loop"), "Jog_Fwd_Loop");
  assert.equal(selectPlayerRigAnimation(pose(), 230, ""), "Sprint_Loop");
  assert.equal(selectPlayerRigAnimation(pose(), 180, "Sprint_Loop"), "Sprint_Loop");
});

test("ordered presentation intents override locomotion without changing pose facts", () => {
  const celebrate = pose("celebrate");
  const dive = pose("dive");
  const tackle = pose("tackle");
  assert.equal(selectPlayerRigAnimation(celebrate, 0, ""), "Dance_Loop");
  assert.equal(selectPlayerRigAnimation(dive, 0, ""), "Roll");
  assert.equal(selectPlayerRigAnimation(tackle, 250, ""), "Idle_Loop");
  assert.deepEqual(celebrate, { anim: "celebrate" });
});
