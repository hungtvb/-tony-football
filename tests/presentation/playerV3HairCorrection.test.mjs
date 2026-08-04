import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { repairPlayerV3Hair } from "../../src/game/presentation/PlayerV3HairCorrection.js";

function rootWithBody() {
  const root = new THREE.Group();
  const skeletonRoot = new THREE.Bone();
  skeletonRoot.name = "Root";
  const head = new THREE.Bone();
  head.name = "Head";
  skeletonRoot.add(head);
  const geometry = new THREE.BoxGeometry(1, 2, .5, 2, 4, 2);
  const vertexCount = geometry.getAttribute("position").count;
  const skinIndex = new Uint16Array(vertexCount * 4);
  const skinWeight = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) {
    skinIndex[index * 4] = 1;
    skinWeight[index * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  const body = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  body.name = "SuperHero_Male";
  body.add(skeletonRoot);
  root.add(body);
  body.bind(new THREE.Skeleton([skeletonRoot, head]));
  body.userData.tonyPlayerV3IntegratedAppearance = true;
  body.userData.tonyPlayerV3HairStyle = "crop";
  body.userData.tonyPlayerV3VariantIndex = 0;
  body.userData.tonyAppearanceMetrics = {
    headBounds: {
      minX: -.18, maxX: .18,
      minY: .55, maxY: .98,
      minZ: -.16, maxZ: .16,
      width: .36, height: .43, depth: .32,
    },
  };

  const staleMaterial = new THREE.MeshStandardMaterial({ color: 0x251711 });
  const staleHair = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), staleMaterial);
  staleHair.name = "TonyPlayerV3Hair";
  staleHair.userData.tonyRigHairGeometry = true;
  staleHair.userData.tonyHairCoverageLayer = "scalp-cap";
  head.add(staleHair);
  root.updateMatrixWorld(true);
  return { root, body, staleHair };
}

test("repairs Head-attached hair into body-rest skinned scalp and crown surfaces", () => {
  const { root, body, staleHair } = rootWithBody();
  const result = repairPlayerV3Hair({ root, three: THREE, lowPowerDevice: true });
  assert.equal(result.installed, true);
  assert.equal(result.placementMode, "body-rest-skinned-v1");
  assert.equal(staleHair.parent, null);

  const hair = [];
  root.traverse((node) => {
    if (node.userData?.tonyRigHairGeometry) hair.push(node);
  });
  assert.equal(hair.length >= 3, true);
  const cap = hair.find((node) => node.userData.tonyHairCoverageLayer === "scalp-cap");
  const crown = hair.find((node) => node.userData.tonyHairCoverageLayer === "crown");
  assert.ok(cap);
  assert.ok(crown);
  for (const node of [cap, crown]) {
    assert.equal(node.isSkinnedMesh, true);
    assert.equal(node.skeleton, body.skeleton);
    assert.equal(node.parent, body.parent);
    assert.equal(node.userData.tonyAppearanceSurfaceKind, "player-v3-skinned-hair");
    assert.equal(node.userData.tonyHairPlacementMode, "body-rest-skinned-v1");
    assert.equal(node.geometry.getAttribute("skinIndex")?.itemSize, 4);
    assert.equal(node.geometry.getAttribute("skinWeight")?.itemSize, 4);
    node.geometry.computeBoundingBox();
    assert.equal(node.geometry.boundingBox.max.y > .9, true);
  }
  const headMinY = .55;
  const headHeight = .43;
  const capMinY = cap.geometry.boundingBox.min.y;
  assert.equal(capMinY < headMinY + (headHeight * .60), true, "scalp cap must cover the upper sides of the head");
  assert.equal(capMinY > headMinY + (headHeight * .30), true, "scalp cap must not fall into a helmet-like low edge");
  assert.equal(crown.geometry.boundingBox.min.y > capMinY, true, "crown must remain above the scalp cap lower edge");
  assert.equal(crown.geometry.boundingBox.max.y >= .97, true, "crown must cover the top of the measured head bounds");
});

test("body-rest skinned hair correction is idempotent", () => {
  const { root } = rootWithBody();
  const first = repairPlayerV3Hair({ root, three: THREE });
  const second = repairPlayerV3Hair({ root, three: THREE });
  assert.deepEqual(second, first);
  const corrected = [];
  root.traverse((node) => {
    if (node.userData?.tonyHairPlacementMode === "body-rest-skinned-v1") corrected.push(node);
  });
  assert.equal(corrected.length, first.count);
});
