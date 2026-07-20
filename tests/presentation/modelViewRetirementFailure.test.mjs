import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createPlayerModelView } from "../../src/game/presentation/PlayerModelView.js";

function canvasContext() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "",
    roundRect() {}, fill() {}, stroke() {}, fillText() {},
  };
}
function documentStub() { return { createElement: () => ({ width: 0, height: 0, getContext: () => canvasContext() }) }; }
function scenePort() { return { addObject() { return true; }, removeObject() { return true; } }; }
function candidateModel() {
  const sourceMaterial = new THREE.MeshStandardMaterial();
  const model = new THREE.Group(); model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial)); return model;
}
const descriptor = Object.freeze({ id: "home-0", team: 0, index: 0, role: "FW", name: "TONY", number: 10, dirX: 1, dirY: 0 });

function mixerOwnershipSpy() {
  const mixers = []; const failure = { method: "", enabled: false };
  class Mixer {
    constructor(model) { this.model = model; this.cached = new Set(); this.scheduled = new Set(); mixers.push(this); }
    clipAction(clip) {
      const mixer = this;
      const action = {
        clip, enabled: false, clampWhenFinished: false, timeScale: 1,
        reset() { return this; }, setLoop() { return this; }, fadeIn() { return this; }, fadeOut() { return this; },
        play() { mixer.scheduled.add(this); return this; },
        stop() { if (failure.enabled && failure.method === "action.stop") throw new Error("action stop failed"); mixer.scheduled.delete(this); return this; },
      };
      this.cached.add(action); return action;
    }
    stopAllAction() { if (failure.enabled && failure.method === "stopAllAction") throw new Error("stop all failed"); this.scheduled.clear(); return this; }
    uncacheRoot(root) { assert.equal(root, this.model); if (failure.enabled && failure.method === "uncacheRoot") throw new Error("uncache root failed"); this.cached.clear(); this.scheduled.clear(); }
    update() {}
  }
  return { three: { ...THREE, AnimationMixer: Mixer }, mixers, fail(method) { failure.method = method; failure.enabled = true; }, recover() { failure.enabled = false; } };
}

for (const method of ["action.stop", "stopAllAction", "uncacheRoot"]) {
  test(`animation refresh commits the candidate and retains failed ${method} cleanup for teardown`, () => {
    const ownership = mixerOwnershipSpy(); const candidate = candidateModel();
    const view = createPlayerModelView({
      player: descriptor, scenePort: scenePort(), document: documentStub(),
      worldX: (value) => value, worldZ: (value) => value,
      three: ownership.three, cloneModel: () => candidate,
    });

    assert.equal(view.installAsset({ characterScene: new THREE.Group(), animations: [{ name: "Idle_Loop" }] }), true);
    const previous = ownership.mixers[0]; ownership.fail(method);

    assert.equal(view.installAnimations([{ name: "Idle_Loop" }, { name: "Jog_Fwd_Loop" }]), true);
    const live = ownership.mixers[1];
    assert.equal(live.scheduled.size, 1);
    assert.equal(live.cached.size, 2);
    assert.equal(view.diagnostics().retiredAnimationSetCount, 1);
    assert.match(view.diagnostics().installError, /refresh committed; previous cleanup deferred/);

    ownership.recover();
    assert.equal(view.teardown(), true);
    assert.equal(previous.scheduled.size, 0);
    assert.equal(previous.cached.size, 0);
    assert.equal(live.scheduled.size, 0);
    assert.equal(live.cached.size, 0);
    assert.equal(view.diagnostics().retiredAnimationSetCount, 0);
  });
}
