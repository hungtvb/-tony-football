import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { ensureRigFootballKitOverlay, rigFootballKitEvidence } from "../../src/game/presentation/RigFootballKitOverlay.js";

function rigRoot() {
  const root = new THREE.Group();
  root.name = "PlayerRoot";
  for (const name of ["spine_02", "pelvis", "calf_l", "calf_r", "foot_l", "foot_r"]) {
    const bone = new THREE.Bone(); bone.name = name; root.add(bone);
  }
  return root;
}

function mesh(root, name) {
  return root.getObjectByName(name);
}

test("installs seven explicit football clothing meshes including two real boot geometries", () => {
  const root = rigRoot();
  const evidence = ensureRigFootballKitOverlay({ root, player: { id: "home-0", team: 0, role: "FW" }, three: THREE });
  assert.equal(evidence.installed, true);
  assert.equal(evidence.visibleKitNodeCount, 7);
  assert.equal(evidence.bootGeometryCount, 2);
  for (const name of ["TonyRigJersey", "TonyRigJerseyBand", "TonyRigShorts", "TonyRigSockLeft", "TonyRigSockRight", "TonyRigBootLeft", "TonyRigBootRight"]) {
    assert.equal(mesh(root, name)?.isMesh, true, `${name} must be explicit mesh geometry`);
    assert.equal(mesh(root, name).userData.tonyRigKitOverlay, true);
  }
  assert.equal(mesh(root, "TonyRigBootLeft").parent.name, "foot_l");
  assert.equal(mesh(root, "TonyRigBootRight").parent.name, "foot_r");
  assert.equal(mesh(root, "TonyRigJersey").parent.name, "spine_02");
  assert.equal(mesh(root, "TonyRigShorts").parent.name, "pelvis");
});

test("overlay installation is idempotent and evidence counts geometry rather than skeleton foot bones", () => {
  const root = rigRoot();
  const first = ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW" }, three: THREE });
  const second = ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW" }, three: THREE });
  assert.deepEqual(second, first);
  assert.equal(rigFootballKitEvidence(root).bootGeometryCount, 2);
  root.getObjectByName("TonyRigBootLeft").removeFromParent();
  assert.equal(rigFootballKitEvidence(root).bootGeometryCount, 1);
});

test("home, away and goalkeeper overlays use distinct visible kit palettes", () => {
  const home = rigRoot(); const away = rigRoot(); const keeper = rigRoot();
  ensureRigFootballKitOverlay({ root: home, player: { team: 0, role: "FW" }, three: THREE });
  ensureRigFootballKitOverlay({ root: away, player: { team: 1, role: "FW" }, three: THREE });
  ensureRigFootballKitOverlay({ root: keeper, player: { team: 0, role: "GK" }, three: THREE });
  assert.equal(mesh(home, "TonyRigJersey").material.color.getHex(), 0xe1bb58);
  assert.equal(mesh(away, "TonyRigJersey").material.color.getHex(), 0x32b8c8);
  assert.equal(mesh(keeper, "TonyRigJersey").material.color.getHex(), 0x7650d6);
  assert.notEqual(mesh(home, "TonyRigShorts").material.color.getHex(), mesh(away, "TonyRigShorts").material.color.getHex());
});

test("missing required skeleton bones fails closed without leaving partial overlay geometry", () => {
  const root = new THREE.Group(); const spine = new THREE.Bone(); spine.name = "spine_02"; root.add(spine);
  assert.throws(() => ensureRigFootballKitOverlay({ root, player: { team: 0, role: "FW" }, three: THREE }), /requires bone pelvis/);
  const evidence = rigFootballKitEvidence(root);
  assert.equal(evidence.installed, false);
  assert.equal(evidence.visibleKitNodeCount, 0);
  assert.equal(evidence.bootGeometryCount, 0);
});
