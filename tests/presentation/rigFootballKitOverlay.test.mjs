import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { ensureRigFootballKitOverlay, rigFootballKitEvidence } from "../../src/game/presentation/RigFootballKitOverlay.js";

function rigRoot({ includeHead = true, includeBody = true, missingRightBootWeights = false } = {}) {
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
  const weightedBoneIndices = missingRightBootWeights ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];
  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = weightedBoneIndices[index % weightedBoneIndices.length];
    skinWeights[index * 4] = 1;
  }
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

test("Player V3 reuses one authoritative skinned body and preserves its source map", () => {
  const root = rigRoot();
  const body = mesh(root, "SuperHero_Male");
  const originalGeometry = body.geometry;
  const originalSkeleton = body.skeleton;
  const originalMaterial = body.material;
  const sourceMap = originalMaterial.map;

  const evidence = ensureRigFootballKitOverlay({ root, player: { id: "home-0", team: 0, role: "FW", index: 0 }, three: THREE });

  assert.equal(evidence.installed, true);
  assert.equal(evidence.appearanceMode, "player-v3-integrated-body-material");
  assert.equal(evidence.variantIndex, 0);
  assert.equal(evidence.variantName, "balanced");
  assert.equal(evidence.skinnedSurfaceCount, 1);
  assert.equal(evidence.integratedBodySurfaceCount, 1);
  assert.equal(evidence.bootRegionCount, 2);
  assert.equal(evidence.hairGeometryCount >= 1, true);
  assert.equal(evidence.rigidPrimitiveCount, 0);
  assert.equal(evidence.surfaceMapPreservedCount, 1);
  assert.equal(evidence.visibleKitNodeCount, 7);
  assert.equal(evidence.bootGeometryCount, 2);
  assert.equal(evidence.kitCoverageComplete, true);
  assert.equal(evidence.kitCoverage.jerseyVertices > 0, true);
  assert.equal(evidence.kitCoverage.shortsVertices > 0, true);
  assert.equal(evidence.kitCoverage.sockVertices > 0, true);
  assert.equal(evidence.kitCoverage.leftBootVertices > 0, true);
  assert.equal(evidence.kitCoverage.rightBootVertices > 0, true);
  assert.equal(body.geometry.getAttribute("tonyKitWeights")?.itemSize, 4);
  assert.equal(body.geometry, originalGeometry);
  assert.equal(body.skeleton, originalSkeleton);
  assert.notEqual(body.material, originalMaterial);
  assert.equal(body.material.map, sourceMap);
  assert.equal(body.material.userData.tonySourceMapPreserved, true);
  assert.equal(body.userData.tonyPlayerV3IntegratedAppearance, true);
  assert.equal(mesh(root, "TonyPlayerV3Hair")?.parent?.name, "Head");
  let skinnedMeshes = 0;
  root.traverse((node) => { if (node.isSkinnedMesh) skinnedMeshes += 1; });
  assert.equal(skinnedMeshes, 1, "appearance must never duplicate the high-detail body");
  for (const removedPrimitive of ["TonyRigJersey", "TonyRigShorts", "TonyRigBootLeft", "TonyRigBootRight"]) {
    assert.equal(mesh(root, removedPrimitive), undefined);
  }
});

test("six stable player indices produce six body, hair and kit variants without box hair", () => {
  const variants = [];
  const cacheKeys = new Set();
  for (let index = 0; index < 6; index += 1) {
    const root = rigRoot();
    const evidence = ensureRigFootballKitOverlay({ root, player: { id: `home-${index}`, team: 0, role: index === 0 ? "GK" : "FW", index }, three: THREE, lowPowerDevice: true });
    variants.push({
      index: evidence.variantIndex,
      name: evidence.variantName,
      pattern: evidence.kitPattern,
      hair: evidence.hairStyle,
    });
    cacheKeys.add(mesh(root, "SuperHero_Male").material.customProgramCacheKey());
    const hairNodes = evidence.nodes.filter((node) => node.hair).map((node) => mesh(root, node.name));
    assert.equal(hairNodes.length >= 1, true);
    assert.equal(hairNodes.every((node) => node?.geometry?.type !== "BoxGeometry"), true);
  }
  assert.deepEqual(variants.map((variant) => variant.index), [0, 1, 2, 3, 4, 5]);
  assert.equal(new Set(variants.map((variant) => variant.name)).size, 6);
  assert.equal(new Set(variants.map((variant) => variant.pattern)).size, 6);
  assert.equal(new Set(variants.map((variant) => variant.hair)).size, 6);
  assert.equal(cacheKeys.size, 6);
});

test("bone-weight shader owns kit, socks and footwear without discarding source pixels", () => {
  const root = rigRoot();
  const body = mesh(root, "SuperHero_Male");
  const sourceMap = body.material.map;
  ensureRigFootballKitOverlay({ root, player: { id: "away-4", team: 1, role: "FW", index: 4 }, three: THREE });
  const shader = compileSource(body.material);
  assert.equal(body.material.map, sourceMap);
  assert.match(shader.vertexShader, /attribute vec4 tonyKitWeights/);
  assert.match(shader.vertexShader, /tonyBootWeight/);
  assert.match(shader.vertexShader, /tonyLayerThickness/);
  assert.match(shader.fragmentShader, /vTonyKitWeights/);
  assert.match(shader.fragmentShader, /tonyAppearanceRegion/);
  assert.match(shader.fragmentShader, /tonyBootLaces/);
  assert.match(shader.fragmentShader, /tonyPatternAccent/);
  assert.doesNotMatch(shader.fragmentShader, /discard/);
});

test("installation is idempotent and evidence fails visible acceptance for foreign appearance primitives", () => {
  const root = rigRoot();
  const body = mesh(root, "SuperHero_Male");
  const first = ensureRigFootballKitOverlay({ root, player: { id: "away-2", team: 1, role: "FW", index: 2 }, three: THREE });
  const firstMaterial = body.material;
  const second = ensureRigFootballKitOverlay({ root, player: { id: "away-2", team: 1, role: "FW", index: 2 }, three: THREE });
  assert.deepEqual(second, first);
  assert.equal(body.material, firstMaterial);

  const foreign = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  foreign.userData.tonyRigAppearanceSurface = true;
  root.add(foreign);
  const degraded = rigFootballKitEvidence(root);
  assert.equal(degraded.rigidPrimitiveCount, 1);
  assert.equal(degraded.skinnedSurfaceCount, 1);
});

test("missing integrated body, Head bone or one boot side fails closed", () => {
  const noBody = rigRoot({ includeBody: false });
  assert.throws(() => ensureRigFootballKitOverlay({ root: noBody, player: { team: 0, role: "FW" }, three: THREE }), /integrated skinned body/);
  assert.equal(rigFootballKitEvidence(noBody).installed, false);

  const noHead = rigRoot({ includeHead: false });
  const body = mesh(noHead, "SuperHero_Male");
  const originalMaterial = body.material;
  assert.throws(() => ensureRigFootballKitOverlay({ root: noHead, player: { team: 0, role: "FW" }, three: THREE }), /requires bone Head/);
  assert.equal(body.material, originalMaterial);
  assert.equal(rigFootballKitEvidence(noHead).installed, false);

  const oneBoot = rigRoot({ missingRightBootWeights: true });
  const oneBootBody = mesh(oneBoot, "SuperHero_Male");
  const oneBootMaterial = oneBootBody.material;
  assert.throws(() => ensureRigFootballKitOverlay({ root: oneBoot, player: { team: 0, role: "FW" }, three: THREE }), /rightBoot=0/);
  assert.equal(oneBootBody.material, oneBootMaterial);
  assert.equal(rigFootballKitEvidence(oneBoot).installed, false);
});
