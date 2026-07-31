import * as THREE_NAMESPACE from "three";

const APPEARANCE_FLAG = "tonyRigAppearanceSurface";
const HAIR_FLAG = "tonyRigHairGeometry";
const PLACEMENT_MODE = "body-rest-skinned-v1";

function materialsOf(node) {
  if (!node?.material) return [];
  return Array.isArray(node.material) ? node.material : [node.material];
}

function disposeHairNodes(nodes) {
  const materials = new Set();
  for (const node of nodes) {
    try { node.parent?.remove?.(node); } catch {}
    try { node.geometry?.dispose?.(); } catch {}
    for (const material of materialsOf(node)) materials.add(material);
  }
  for (const material of materials) {
    try { material?.dispose?.(); } catch {}
  }
}

function findIntegratedBody(root) {
  let preferred = null;
  root?.traverse?.((node) => {
    if (!node.isSkinnedMesh || !node.skeleton || !node.geometry?.attributes?.position) return;
    if (node.userData?.tonyPlayerV3IntegratedAppearance || /superhero|body|male|character/i.test(node.name ?? "")) preferred ??= node;
  });
  return preferred;
}

function normalizedBoneName(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function headBoneIndex(body) {
  const bones = body?.skeleton?.bones ?? [];
  const exact = bones.findIndex((bone) => normalizedBoneName(bone?.name) === "head");
  if (exact >= 0) return exact;
  const fallback = bones.findIndex((bone) => /(^|_)(head|skull)(_|$)/.test(normalizedBoneName(bone?.name)));
  return fallback >= 0 ? fallback : null;
}

function validBounds(bounds) {
  return bounds
    && Number.isFinite(bounds.minX)
    && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.minZ)
    && Number.isFinite(bounds.maxX)
    && Number.isFinite(bounds.maxY)
    && Number.isFinite(bounds.maxZ)
    && Number(bounds.width) > 0
    && Number(bounds.height) > 0
    && Number(bounds.depth) > 0;
}

function transformedGeometry(THREE, geometry, position, scale, rotation = [0, 0, 0]) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function skinGeometryToBone(THREE, geometry, boneIndex) {
  const count = geometry.getAttribute("position")?.count ?? 0;
  if (count <= 0) throw new Error("Player V3 hair requires geometry positions");
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    indices[index * 4] = boneIndex;
    weights[index * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  return geometry;
}

function createHairMesh({ THREE, body, geometry, material, name, layer, style, variantIndex }) {
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = name;
  mesh.userData[APPEARANCE_FLAG] = true;
  mesh.userData[HAIR_FLAG] = true;
  mesh.userData.tonyAppearanceSemantic = "hair";
  mesh.userData.tonyAppearanceSurfaceKind = "player-v3-skinned-hair";
  mesh.userData.tonyHairCoverageLayer = layer;
  mesh.userData.tonyHairPlacementMode = PLACEMENT_MODE;
  mesh.userData.tonyPlayerV3HairStyle = style;
  mesh.userData.tonyPlayerV3VariantIndex = variantIndex;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
  mesh.scale.copy(body.scale);
  mesh.bindMode = body.bindMode;
  body.parent.add(mesh);
  mesh.bind(body.skeleton, body.bindMatrix);
  return mesh;
}

function existingCorrectedHair(root) {
  const nodes = [];
  root?.traverse?.((node) => {
    if (node.userData?.[HAIR_FLAG] && node.userData?.tonyHairPlacementMode === PLACEMENT_MODE) nodes.push(node);
  });
  const cap = nodes.some((node) => node.userData?.tonyHairCoverageLayer === "scalp-cap");
  const crown = nodes.some((node) => node.userData?.tonyHairCoverageLayer === "crown");
  return cap && crown ? nodes : [];
}

export function repairPlayerV3Hair({ root, three = THREE_NAMESPACE, lowPowerDevice = false } = {}) {
  if (!root || typeof root.traverse !== "function") throw new TypeError("Player V3 hair correction requires a root");
  const existing = existingCorrectedHair(root);
  if (existing.length) return Object.freeze({ installed: true, count: existing.length, placementMode: PLACEMENT_MODE });

  const THREE = three;
  const body = findIntegratedBody(root);
  if (!body || !body.parent) throw new Error("Player V3 hair correction requires an integrated body with a parent");
  const bounds = body.userData?.tonyAppearanceMetrics?.headBounds
    ?? body.geometry?.userData?.tonyRigAppearanceMetrics?.headBounds;
  if (!validBounds(bounds)) throw new Error("Player V3 hair correction requires measured head bounds");
  const boneIndex = headBoneIndex(body);
  if (boneIndex === null) throw new Error("Player V3 hair correction requires Head bone");

  const previousHair = [];
  root.traverse((node) => {
    if (node.userData?.[HAIR_FLAG]) previousHair.push(node);
  });

  const style = body.userData?.tonyPlayerV3HairStyle ?? "crop";
  const variantIndex = Number(body.userData?.tonyPlayerV3VariantIndex ?? 0);
  const sourceColor = previousHair.flatMap(materialsOf).find((material) => material?.color)?.color?.getHex?.() ?? 0x1a120f;
  const material = new THREE.MeshStandardMaterial({ color: sourceColor, roughness: .84, metalness: 0 });
  material.name = "TonyPlayerV3SkinnedHairMaterial";
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  material.userData.tonyOwnedRigAppearanceMaterial = true;
  material.userData.tonyPlayerV3HairStyle = style;

  const segments = lowPowerDevice ? 12 : 20;
  const verticalSegments = lowPowerDevice ? 8 : 12;
  const width = bounds.width;
  const height = bounds.height;
  const depth = bounds.depth;
  const centerX = (bounds.minX + bounds.maxX) * .5;
  const centerZ = (bounds.minZ + bounds.maxZ) * .5;
  const capCenterY = bounds.minY + (height * .67);
  const crownCenterY = bounds.minY + (height * .86);
  const meshes = [];

  const add = (geometry, name, layer, position, scale, rotation = [0, 0, 0]) => {
    const shaped = transformedGeometry(THREE, geometry, position, scale, rotation);
    skinGeometryToBone(THREE, shaped, boneIndex);
    const mesh = createHairMesh({ THREE, body, geometry: shaped, material, name, layer, style, variantIndex });
    meshes.push(mesh);
    return mesh;
  };

  try {
    add(
      new THREE.SphereGeometry(.5, segments, verticalSegments, 0, Math.PI * 2, 0, Math.PI * .58),
      "TonyPlayerV3Hair",
      "scalp-cap",
      [centerX, capCenterY, centerZ + (depth * .01)],
      [width * 1.08, height * .72, depth * 1.09],
    );
    add(
      new THREE.SphereGeometry(.5, segments, verticalSegments),
      "TonyPlayerV3HairCrown",
      "crown",
      [centerX, crownCenterY, centerZ + (depth * .005)],
      [width * .86, height * .25, depth * .88],
    );

    const frontZ = bounds.minZ - (depth * .01);
    const styleY = bounds.minY + (height * .88);
    const sphere = () => new THREE.SphereGeometry(.5, segments, verticalSegments);
    switch (style) {
      case "fade":
        add(sphere(), "TonyPlayerV3HairTop", "style", [centerX, styleY, centerZ], [width * .72, height * .20, depth * .72], [-.08, 0, 0]);
        break;
      case "curly": {
        const offsets = [[-.28, .01, -.12], [0, .09, -.18], [.28, .01, -.12], [-.18, .04, .18], [.18, .04, .18]];
        offsets.forEach(([x, y, z], index) => add(
          new THREE.DodecahedronGeometry(.5, 0),
          `TonyPlayerV3Curl${index + 1}`,
          "style",
          [centerX + (width * x), styleY + (height * y), centerZ + (depth * z)],
          [width * .22, height * .17, depth * .20],
        ));
        break;
      }
      case "quiff":
        add(sphere(), "TonyPlayerV3HairQuiffLeft", "style", [centerX - (width * .13), styleY, frontZ], [width * .40, height * .21, depth * .30], [-.18, 0, -.10]);
        add(sphere(), "TonyPlayerV3HairQuiffRight", "style", [centerX + (width * .14), styleY + (height * .02), frontZ], [width * .42, height * .23, depth * .31], [-.21, 0, .12]);
        break;
      case "mohawk":
        [-.30, -.10, .10, .30].forEach((z, index) => add(
          new THREE.ConeGeometry(.5, 1, lowPowerDevice ? 6 : 8),
          `TonyPlayerV3HairMohawk${index + 1}`,
          "style",
          [centerX, styleY + (height * .08), centerZ + (depth * z)],
          [width * .12, height * .32, depth * .12],
        ));
        break;
      case "buzz":
        break;
      case "crop":
      default:
        add(sphere(), "TonyPlayerV3HairFringe", "style", [centerX, styleY - (height * .03), frontZ], [width * .56, height * .14, depth * .24], [-.14, 0, 0]);
        break;
    }

    disposeHairNodes(previousHair);
    return Object.freeze({ installed: true, count: meshes.length, placementMode: PLACEMENT_MODE });
  } catch (error) {
    disposeHairNodes(meshes);
    try { material.dispose?.(); } catch {}
    throw error;
  }
}
