import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { ensureRigFootballKitOverlay, rigFootballKitEvidence } from "../../src/game/presentation/RigFootballKitOverlay.js";

function rigRoot({ includeHead = true, includeBody = true } = {}) {
  const root = new THREE.Group();
  root.name = "PlayerRoot";
  const skeletonRoot = new THREE.Bone(); skeletonRoot.name = "Root";
  const names = ["spine_02", "pelvis", "calf_l", "calf_r", "foot_l", "foot_r", ...(includeHead ? ["Head"] : [])];
  const bones = names.map((name) => { const bone = new THREE.Bone(); bone.name = name; skeletonRoot.add(bone); return bone; });
  if (includeBody) {
    const geometry = new THREE.BoxGeometry(1, 2, .5, 2, 4, 2);
    const vertexCount = geometry.attributes.position.count;
    const skinIndices = new Uint16Array(vertexCount * 4);
    const skinWeights = new Float32Array(vertexCount * 4);
    for (let index = 0; index < vertexCount; index += 1) skinWeights[index * 4] = 1;
    geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
    const texture = new THREE.Texture(); texture.name = "source-body-map";
    const body = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff }));
    body.name = "SuperHero_Male";
    body.add(skeletonRoot);
    root.add(body);
    body.bind(new THREE.Skeleton([skeletonRoot, ...bones]));
  } else {
    root.add(skeletonRoot);
  }
  return root;
}

function mesh(root, name) {
  return root.getObjectByName(name);
}

function compileSource(material) {
  const shader = {
    vertexShader: "#include <common>\n#include <begin_vertex>",
    fragmentShader: "#include <common>\n#include <map_fragment>",
  };
  material.onBeforeCompile(shader);
  return shader;
}

test("installs body-conforming skinned kit and boot surfaces plus explicit asset hair", () => {
  const root = rigRoot();
  const source = mesh(root, "SuperHero_Male");
  const evidence = ensureRigFootballKitOverlay({ root, player: { id: "home-0", team: 0, role: "FW", index: 0 }, three: THREE });
  assert.equal(evidence.installed, true);
  assert.equal(evidence.appearanceMode, "skinned-surface");
  assert.equal(evidence.skinnedSurfaceCount, 3);
  assert.equal(evidence.bootSurfaceCount, 2);
  assert.equal(evidence.hairGeometryCount, 1);
  assert.equal(evidence.rigidPrimitiveCount, 0);
  assert.equal(evidence.surfaceMapPreservedCount, 3);
  for (const name of ["TonyRigKitSurface", "TonyRigBootSurfaceLeft", "TonyRigBootSurfaceRight"]) {
    const surface = mesh(root, name);
    assert.equal(surface?.isSkinnedMesh, true, `${name} must reuse the animated skinned body`);
    assert.equal(surface.geometry, source.geometry, `${name} must share the fitted body geometry`);
    assert.equal(surface.skeleton, source.skeleton, `${name} must share the authoritative rig skeleton`);
    assert.equal(surface.userData.tonyBodyConforming, true);
    assert.equal(surface.userData.tonySharedGeometry, true);
  }
  assert.equal(mesh(root, "TonyRigHair")?.parent?.name, "Head");
  assert.equal(mesh(root, "TonyRigHair")?.userData.tonyRigHairGeometry, true);
  assert.equal(mesh(root, "TonyRigJersey"), undefined);
  assert.equal(mesh(root, "TonyRigShorts"), undefined);
});

test("surface materials preserve source maps and mask body regions in shader space", () => {
  const root = rigRoot();
  const source = mesh(root, "SuperHero_Male");
  ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW", index: 1 }, three: THREE });
  for (const name of ["TonyRigKitSurface", "TonyRigBootSurfaceLeft", "TonyRigBootSurfaceRight"]) {
    const surface = mesh(root, name);
    const material = Array.isArray(surface.material) ? surface.material[0] : surface.material;
    assert.equal(material.map, source.material.map);
    assert.equal(material.userData.tonySourceMapPreserved, true);
    const shader = compileSource(material);
    assert.match(shader.vertexShader, /vTonyBodyPosition = position/);
    assert.match(shader.vertexShader, /objectNormal/);
    assert.match(shader.fragmentShader, /discard/);
    assert.match(shader.fragmentShader, /tonyTone/);
  }
});

test("installation is idempotent and evidence rejects rigid primitive substitution", () => {
  const root = rigRoot();
  const first = ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW", index: 2 }, three: THREE });
  const second = ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW", index: 2 }, three: THREE });
  assert.deepEqual(second, first);
  const rigid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  rigid.userData.tonyRigAppearanceSurface = true;
  root.add(rigid);
  const degraded = rigFootballKitEvidence(root);
  assert.equal(degraded.rigidPrimitiveCount, 1);
  assert.equal(degraded.skinnedSurfaceCount, 3);
});

test("home, away and goalkeeper surfaces compile distinct palette contracts", () => {
  const home = rigRoot(); const away = rigRoot(); const keeper = rigRoot();
  ensureRigFootballKitOverlay({ root: home, player: { team: 0, role: "FW", index: 0 }, three: THREE });
  ensureRigFootballKitOverlay({ root: away, player: { team: 1, role: "FW", index: 0 }, three: THREE });
  ensureRigFootballKitOverlay({ root: keeper, player: { team: 0, role: "GK", index: 0 }, three: THREE });
  const key = (root) => mesh(root, "TonyRigKitSurface").material.customProgramCacheKey();
  assert.notEqual(key(home), key(away));
  assert.notEqual(key(home), key(keeper));
  assert.notEqual(mesh(home, "TonyRigHair").material.color.getHex(), mesh(away, "TonyRigHair").material.color.getHex());
});

test("missing integrated body or Head bone fails closed without disposing shared source geometry", () => {
  const noBody = rigRoot({ includeBody: false });
  assert.throws(() => ensureRigFootballKitOverlay({ root: noBody, player: { team: 0, role: "FW" }, three: THREE }), /integrated skinned body/);
  assert.equal(rigFootballKitEvidence(noBody).installed, false);

  const noHead = rigRoot({ includeHead: false });
  const sourceGeometry = mesh(noHead, "SuperHero_Male").geometry;
  let disposed = false;
  const originalDispose = sourceGeometry.dispose.bind(sourceGeometry);
  sourceGeometry.dispose = () => { disposed = true; originalDispose(); };
  assert.throws(() => ensureRigFootballKitOverlay({ root: noHead, player: { team: 0, role: "FW" }, three: THREE }), /requires bone Head/);
  const evidence = rigFootballKitEvidence(noHead);
  assert.equal(evidence.installed, false);
  assert.equal(evidence.skinnedSurfaceCount, 0);
  assert.equal(disposed, false);
});
