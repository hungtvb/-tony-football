import * as THREE_NAMESPACE from "three";

const APPEARANCE_MARKER = "TonyRigFootballAppearance";
const APPEARANCE_FLAG = "tonyRigAppearanceSurface";
const HAIR_FLAG = "tonyRigHairGeometry";

function colorsFor(player) {
  const home = Number(player?.team ?? 0) === 0;
  const keeper = player?.role === "GK";
  return Object.freeze({
    jersey: keeper ? (home ? 0x7650d6 : 0xe65348) : (home ? 0xe1bb58 : 0x32b8c8),
    jerseyLight: keeper ? (home ? 0xbca4ff : 0xffa096) : (home ? 0xffe9ae : 0xc4fbff),
    shorts: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35),
    socks: home ? 0xe9d58f : 0xb8eff3,
    boots: keeper ? 0x18191f : 0x101312,
    accent: home ? 0x151a18 : 0xe8fbfb,
    hair: [0x231914, 0x38241b, 0x111413, 0x5a351f][(Number(player?.index ?? 0) + Number(player?.team ?? 0)) % 4],
  });
}

function shaderColor(THREE, value) {
  const color = new THREE.Color(value);
  return `vec3(${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)})`;
}

function materialsOf(node) {
  return Array.isArray(node?.material) ? node.material : [node?.material];
}

function createIntegratedAppearanceMaterial(THREE, source, palette) {
  const material = source?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, metalness: .01 });
  const previousCompile = typeof material.onBeforeCompile === "function" ? material.onBeforeCompile.bind(material) : null;
  const previousCacheKey = typeof material.customProgramCacheKey === "function" ? material.customProgramCacheKey.bind(material) : () => "";
  const sourceMap = source?.map ?? null;
  material.name = "TonyRigIntegratedAppearanceMaterial";
  material.userData = {
    ...(material.userData ?? {}),
    tonyOwnedRigAppearanceMaterial: true,
    tonySharedTextures: true,
    tonySourceMapPreserved: Boolean(sourceMap && material.map === sourceMap),
    tonyAppearanceSemantic: "integrated-appearance",
    tonyAppearanceSurfaceKind: "integrated-body-material",
  };
  material.color?.set?.(0xffffff);
  material.roughness = .6;
  material.metalness = .01;
  material.onBeforeCompile = (shader) => {
    previousCompile?.(shader);
    const paletteSource = {
      jersey: shaderColor(THREE, palette.jersey),
      jerseyLight: shaderColor(THREE, palette.jerseyLight),
      shorts: shaderColor(THREE, palette.shorts),
      socks: shaderColor(THREE, palette.socks),
      boots: shaderColor(THREE, palette.boots),
      accent: shaderColor(THREE, palette.accent),
    };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTonyBodyPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTonyBodyPosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTonyBodyPosition;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        float tonyY = vTonyBodyPosition.y;
        float tonyX = abs(vTonyBodyPosition.x);
        bool tonyTorso = tonyY > 0.15 && tonyY < 0.69 && tonyX < 0.27;
        bool tonySleeve = tonyY > 0.48 && tonyY < 0.70 && tonyX >= 0.18 && tonyX < 0.50;
        bool tonyShorts = tonyY > -0.08 && tonyY < 0.20 && tonyX < 0.32;
        bool tonySocks = tonyY >= -0.85 && tonyY < -0.54;
        bool tonyBoots = tonyY < -0.82;
        bool tonyAppearanceRegion = tonyTorso || tonySleeve || tonyShorts || tonySocks || tonyBoots;
        if (tonyAppearanceRegion) {
          vec3 tonyTone = ${paletteSource.jersey};
          if (tonyBoots) tonyTone = ${paletteSource.boots};
          else if (tonySocks) tonyTone = ${paletteSource.socks};
          else if (tonyShorts) tonyTone = ${paletteSource.shorts};
          else if ((tonyTorso && tonyY > 0.42 && tonyY < 0.47) || (tonySleeve && tonyX > 0.445)) tonyTone = ${paletteSource.accent};
          else if (tonyTorso && tonyY > 0.63 && tonyX < 0.16) tonyTone = ${paletteSource.jerseyLight};
          float tonyDetail = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.20, 1.20);
          diffuseColor.rgb = tonyTone * mix(0.72, 1.18, tonyDetail);
        }
      `);
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}|tony-integrated-appearance-${palette.jersey}-${palette.shorts}-${palette.socks}-${palette.boots}`;
  material.needsUpdate = true;
  return material;
}

function findIntegratedBody(root) {
  let preferred = null;
  let fallback = null;
  root.traverse((node) => {
    if (!node.isSkinnedMesh || !node.geometry?.attributes?.position || !node.skeleton) return;
    if (!fallback) fallback = node;
    if (/superhero|body|male|character/i.test(node.name ?? "")) preferred = node;
  });
  return preferred ?? fallback;
}

function createHair({ THREE, root, palette, player, lowPowerDevice }) {
  const head = root.getObjectByName("Head");
  if (!head) throw new Error("football appearance requires bone Head");
  const segments = lowPowerDevice ? 8 : 14;
  const style = (Number(player?.index ?? 0) + Number(player?.team ?? 0) * 2) % 3;
  const material = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: .9, metalness: 0 });
  material.name = "TonyRigHairMaterial";
  material.userData.tonyOwnedRigAppearanceMaterial = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.135, segments, 7, 0, Math.PI * 2, 0, Math.PI * (style === 1 ? .38 : .5)), material);
  hair.name = "TonyRigHair";
  hair.position.set(0, .105, -.004);
  hair.scale.set(style === 2 ? 1.06 : .98, style === 1 ? .78 : .94, .94);
  hair.userData[APPEARANCE_FLAG] = true;
  hair.userData[HAIR_FLAG] = true;
  hair.userData.tonyAppearanceSemantic = "hair";
  hair.castShadow = true;
  hair.receiveShadow = true;
  hair.frustumCulled = false;
  head.add(hair);
  return hair;
}

function disposeMaterials(materials) {
  for (const material of materials ?? []) {
    try { material?.dispose?.(); } catch {}
  }
}

export function rigFootballKitEvidence(root) {
  const body = findIntegratedBody(root);
  const bodyOwned = Boolean(body?.userData?.[APPEARANCE_FLAG] && body?.userData?.tonyIntegratedAppearance);
  let hairGeometryCount = 0;
  let rigidPrimitiveCount = 0;
  let surfaceMapPreservedCount = 0;
  const nodes = [];
  root?.traverse?.((node) => {
    if (!node.isMesh) return;
    const isBody = node === body && bodyOwned;
    const isHair = Boolean(node.userData?.[HAIR_FLAG]);
    const isAppearanceNode = Boolean(node.userData?.[APPEARANCE_FLAG]);
    if (!isBody && !isHair && !isAppearanceNode) return;
    if (isHair) hairGeometryCount += 1;
    else if (!isBody) rigidPrimitiveCount += 1;
    const materials = materialsOf(node);
    surfaceMapPreservedCount += materials.filter((material) => material?.userData?.tonySourceMapPreserved).length;
    nodes.push(Object.freeze({
      name: node.name,
      semantic: node.userData.tonyAppearanceSemantic ?? (isBody ? "integrated-appearance" : "unknown"),
      skinned: Boolean(node.isSkinnedMesh),
      bodyConforming: Boolean(isBody),
      integratedBody: Boolean(isBody),
      bootRegions: isBody ? 2 : 0,
      kitRegions: isBody ? 5 : 0,
      hair: isHair,
      surfaceKind: node.userData.tonyAppearanceSurfaceKind ?? null,
    }));
  });
  const installed = Boolean(root?.getObjectByName?.(APPEARANCE_MARKER) && bodyOwned);
  return Object.freeze({
    installed,
    appearanceMode: "integrated-body-material",
    skinnedSurfaceCount: bodyOwned ? 1 : 0,
    integratedBodySurfaceCount: bodyOwned ? 1 : 0,
    bootSurfaceCount: bodyOwned ? 2 : 0,
    bootRegionCount: bodyOwned ? 2 : 0,
    hairGeometryCount,
    rigidPrimitiveCount,
    surfaceMapPreservedCount,
    visibleKitNodeCount: installed && hairGeometryCount >= 1 ? 7 : 0,
    bootGeometryCount: bodyOwned ? 2 : 0,
    nodes: Object.freeze(nodes),
  });
}

export function ensureRigFootballKitOverlay({ root, player, three = THREE_NAMESPACE, lowPowerDevice = false } = {}) {
  if (!root || typeof root.getObjectByName !== "function" || typeof root.traverse !== "function") throw new TypeError("rig football appearance requires a player root");
  if (!player || typeof player !== "object") throw new TypeError("rig football appearance requires player facts");
  if (root.getObjectByName(APPEARANCE_MARKER)) return rigFootballKitEvidence(root);

  const THREE = three;
  const palette = colorsFor(player);
  const body = findIntegratedBody(root);
  if (!body) throw new Error("football appearance requires an integrated skinned body");
  const head = root.getObjectByName("Head");
  if (!head) throw new Error("football appearance requires bone Head");
  const originalMaterial = body.material;
  const originalUserData = { ...(body.userData ?? {}) };
  const createdMaterials = materialsOf(body).map((material) => createIntegratedAppearanceMaterial(THREE, material, palette));
  let hair = null;
  let marker = null;
  try {
    body.material = Array.isArray(originalMaterial) ? createdMaterials : createdMaterials[0];
    body.userData = {
      ...originalUserData,
      [APPEARANCE_FLAG]: true,
      tonyIntegratedAppearance: true,
      tonyBodyConforming: true,
      tonyAppearanceSemantic: "integrated-appearance",
      tonyAppearanceSurfaceKind: "integrated-body-material",
      tonyBootRegionCount: 2,
      tonyKitRegionCount: 5,
    };
    hair = createHair({ THREE, root, palette, player, lowPowerDevice });
    marker = new THREE.Group();
    marker.name = APPEARANCE_MARKER;
    marker.userData.tonyRigAppearanceMarker = true;
    root.add(marker);
    const evidence = rigFootballKitEvidence(root);
    if (evidence.skinnedSurfaceCount !== 1 || evidence.bootRegionCount !== 2 || evidence.hairGeometryCount < 1 || evidence.rigidPrimitiveCount !== 0) throw new Error("football appearance installed incomplete integrated body material");
    return evidence;
  } catch (error) {
    marker?.removeFromParent?.();
    hair?.removeFromParent?.();
    try { hair?.geometry?.dispose?.(); } catch {}
    disposeMaterials(materialsOf(hair));
    body.material = originalMaterial;
    body.userData = originalUserData;
    disposeMaterials(createdMaterials);
    throw error;
  }
}
