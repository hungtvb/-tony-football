import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { ensureRigFootballKitOverlay, rigFootballKitEvidence } from "../../src/game/presentation/RigFootballKitOverlay.js";

function rigRoot({ includeHead = true, includeBody = true } = {}) {
  const root = new THREE.Group();
  root.name = "PlayerRoot";
  const skeletonRoot = new THREE.Bone();
  skeletonRoot.name = "Root";
  const names = ["spine_02", "pelvis", "calf_l", "calf_r", "foot_l", "foot_r", ...(includeHead ? ["Head"] : [])];
  const bones = names.map((name) => { const bone = new THREE.Bone(); bone.name = name; skeletonRoot.add(bone); return bone; });
  if (!includeBody) { root.add(skeletonRoot); return root; }

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
  return root;
}

const mesh = (root, name) => root.getObjectByName(name);

function compileSource(material) {
  const shader = {
    vertexShader: "#include <common>\n#include <begin_vertex>",
    fragmentShader: "#include <common>\n#include <map_fragment>",
  };
  material.onBeforeCompile(shader);
  return shader;
}

test("reuses the authoritative body geometry and skeleton while adding integrated kit, footwear regions and explicit hair", () => {
  const root = rigRoot();
  const body = mesh(root, "SuperHero_Male");
  const originalGeometry = body.geometry;
  const originalSkeleton = body.skeleton;
  const originalMaterial = body.material;
  const sourceMap = originalMaterial.map;
  const evidence = ensureRigFootballKitOverlay({ root, player: { id: "home-0", team: 0, role: "FW", index: 0 }, three: THREE });

  assert.equal(evidence.installed, true);
  assert.equal(evidence.appearanceMode, "integrated-body-material");
  assert.equal(evidence.skinnedSurfaceCount, 1);
  assert.equal(evidence.integratedBodySurfaceCount, 1);
  assert.equal(evidence.bootRegionCount, 2);
  assert.equal(evidence.bootGeometryCount, 2);
  assert.equal(evidence.hairGeometryCount, 1);
  assert.equal(evidence.rigidPrimitiveCount, 0);
  assert.equal(evidence.surfaceMapPreservedCount, 1);
  assert.equal(evidence.visibleKitNodeCount, 7);
  assert.equal(body.geometry, originalGeometry);
  assert.equal(body.skeleton, originalSkeleton);
  assert.notEqual(body.material, originalMaterial);
  assert.equal(body.material.map, sourceMap);
  assert.equal(body.material.userData.tonySourceMapPreserved, true);
  assert.equal(body.userData.tonyIntegratedAppearance, true);
  assert.equal(body.userData.tonyBootRegionCount, 2);
  assert.equal(mesh(root, "TonyRigHair")?.parent?.name, "Head");
  assert.equal(mesh(root, "TonyRigHair")?.userData.tonyRigHairGeometry, true);
  let skinnedMeshes = 0;
  root.traverse((node) => { if (node.isSkinnedMesh) skinnedMeshes += 1; });
  assert.equal(skinnedMeshes, 1, "appearance must not duplicate the high-detail skinned body");
  assert.equal(mesh(root, "TonyRigKitSurface"), undefined);
  assert.equal(mesh(root, "TonyRigBootSurfaceLeft"), undefined);
});

test("integrated material preserves source-map detail and replaces only body-space football regions", () => {
  const root = rigRoot();
  const body = mesh(root, "SuperHero_Male");
  const sourceMap = body.material.map;
  ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW", index: 1 }, three: THREE });
  const material = body.material;
  assert.equal(material.map, sourceMap);
  assert.equal(material.userData.tonySourceMapPreserved, true);
  const shader = compileSource(material);
  assert.match(shader.vertexShader, /vTonyBodyPosition = position/);
  assert.match(shader.fragmentShader, /tonyAppearanceRegion/);
  assert.match(shader.fragmentShader, /tonyBoots/);
  assert.match(shader.fragmentShader, /tonyShorts/);
  assert.doesNotMatch(shader.fragmentShader, /discard/);
});

test("installation is idempotent and evidence rejects added rigid appearance primitives", () => {
  const root = rigRoot();
  const body = mesh(root, "SuperHero_Male");
  const first = ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW", index: 2 }, three: THREE });
  const firstMaterial = body.material;
  const second = ensureRigFootballKitOverlay({ root, player: { id: "away-0", team: 1, role: "FW", index: 2 }, three: THREE });
  assert.deepEqual(second, first);
  assert.equal(body.material, firstMaterial);
  const rigid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  rigid.userData.tonyRigAppearanceSurface = true;
  root.add(rigid);
  const degraded = rigFootballKitEvidence(root);
  assert.equal(degraded.rigidPrimitiveCount, 1);
  assert.equal(degraded.skinnedSurfaceCount, 1);
});

test("home, away and goalkeeper integrated materials compile distinct palette contracts", () => {
  const home = rigRoot(); const away = rigRoot(); const keeper = rigRoot();
  ensureRigFootballKitOverlay({ root: home, player: { team: 0, role: "FW", index: 0 }, three: THREE });
  ensureRigFootballKitOverlay({ root: away, player: { team: 1, role: "FW", index: 0 }, three: THREE });
  ensureRigFootballKitOverlay({ root: keeper, player: { team: 0, role: "GK", index: 0 }, three: THREE });
  const key = (root) => mesh(root, "SuperHero_Male").material.customProgramCacheKey();
  assert.notEqual(key(home), key(away));
  assert.notEqual(key(home), key(keeper));
  assert.notEqual(mesh(home, "TonyRigHair").material.color.getHex(), mesh(away, "TonyRigHair").material.color.getHex());
});

test("missing integrated body or Head bone fails closed without mutating the source body material", () => {
  const noBody = rigRoot({ includeBody: false });
  assert.throws(() => ensureRigFootballKitOverlay({ root: noBody, player: { team: 0, role: "FW" }, three: THREE }), /integrated skinned body/);
  assert.equal(rigFootballKitEvidence(noBody).installed, false);

  const noHead = rigRoot({ includeHead: false });
  const body = mesh(noHead, "SuperHero_Male");
  const originalMaterial = body.material;
  assert.throws(() => ensureRigFootballKitOverlay({ root: noHead, player: { team: 0, role: "FW" }, three: THREE }), /requires bone Head/);
  assert.equal(body.material, originalMaterial);
  assert.equal(rigFootballKitEvidence(noHead).installed, false);
});
