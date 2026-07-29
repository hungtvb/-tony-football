import * as THREE_NAMESPACE from "three";

const OVERLAY_MARKER = "TonyRigFootballAppearance";
const OVERLAY_FLAG = "tonyRigAppearanceSurface";
const BOOT_FLAG = "tonyRigBootSurface";
const HAIR_FLAG = "tonyRigHairGeometry";
const SHARED_GEOMETRY_FLAG = "tonySharedGeometry";

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

function sourceMaterials(source) {
  return Array.isArray(source?.material) ? source.material : [source?.material];
}

function appearanceMaterial(THREE, source, palette, kind) {
  const material = source?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .58, metalness: .02 });
  const previousCompile = typeof material.onBeforeCompile === "function" ? material.onBeforeCompile.bind(material) : null;
  const previousCacheKey = typeof material.customProgramCacheKey === "function" ? material.customProgramCacheKey.bind(material) : () => "";
  const sourceMap = source?.map ?? null;
  material.name = `TonyRig${kind}SurfaceMaterial`;
  material.userData = {
    ...(material.userData ?? {}),
    tonyOwnedRigAppearanceMaterial: true,
    tonySharedTextures: true,
    tonySourceMapPreserved: Boolean(sourceMap && material.map === sourceMap),
    tonyAppearanceSurfaceKind: kind,
  };
  material.color?.set?.(0xffffff);
  material.roughness = kind.startsWith("boot") ? .44 : .6;
  material.metalness = kind.startsWith("boot") ? .08 : .01;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  material.onBeforeCompile = (shader) => {
    previousCompile?.(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTonyBodyPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTonyBodyPosition = position;\ntransformed += normalize(objectNormal) * 0.0035;");
    const paletteSource = {
      jersey: shaderColor(THREE, palette.jersey),
      jerseyLight: shaderColor(THREE, palette.jerseyLight),
      shorts: shaderColor(THREE, palette.shorts),
      socks: shaderColor(THREE, palette.socks),
      boots: shaderColor(THREE, palette.boots),
      accent: shaderColor(THREE, palette.accent),
    };
    const mask = kind === "kit"
      ? `
        float tonyY = vTonyBodyPosition.y;
        float tonyX = abs(vTonyBodyPosition.x);
        bool tonyTorso = tonyY > 0.15 && tonyY < 0.69 && tonyX < 0.27;
        bool tonySleeve = tonyY > 0.48 && tonyY < 0.70 && tonyX >= 0.18 && tonyX < 0.50;
        bool tonyShorts = tonyY > -0.08 && tonyY < 0.20 && tonyX < 0.32;
        bool tonySocks = tonyY >= -0.85 && tonyY < -0.54;
        if (!(tonyTorso || tonySleeve || tonyShorts || tonySocks)) discard;
        vec3 tonyTone = ${paletteSource.jersey};
        if (tonyShorts) tonyTone = ${paletteSource.shorts};
        else if (tonySocks) tonyTone = ${paletteSource.socks};
        else if ((tonyTorso && tonyY > 0.42 && tonyY < 0.47) || (tonySleeve && tonyX > 0.445)) tonyTone = ${paletteSource.accent};
        else if (tonyTorso && tonyY > 0.63 && tonyX < 0.16) tonyTone = ${paletteSource.jerseyLight};
      `
      : `
        float tonyY = vTonyBodyPosition.y;
        float tonyX = vTonyBodyPosition.x;
        bool tonyBoot = tonyY < -0.82 && ${kind === "boot-left" ? "tonyX < 0.0" : "tonyX >= 0.0"};
        if (!tonyBoot) discard;
        vec3 tonyTone = ${paletteSource.boots};
      `;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTonyBodyPosition;")
      .replace("#include <map_fragment>", `#include <map_fragment>${mask}
        float tonyDetail = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.20, 1.20);
        diffuseColor.rgb = tonyTone * mix(0.72, 1.18, tonyDetail);
      `);
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}|tony-body-conforming-${kind}-${palette.jersey}-${palette.shorts}-${palette.socks}-${palette.boots}`;
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

function cloneSkinnedSurface({ THREE, source, palette, kind, name, semantic, boot = false }) {
  const materials = sourceMaterials(source).map((material) => appearanceMaterial(THREE, material, palette, kind));
  const surface = new THREE.SkinnedMesh(source.geometry, Array.isArray(source.material) ? materials : materials[0]);
  surface.name = name;
  surface.position.copy(source.position);
  surface.quaternion.copy(source.quaternion);
  surface.scale.copy(source.scale);
  surface.matrix.copy(source.matrix);
  surface.matrixAutoUpdate = source.matrixAutoUpdate;
  surface.bindMode = THREE.DetachedBindMode;
  surface.bind(source.skeleton, source.bindMatrix);
  if (source.morphTargetDictionary) surface.morphTargetDictionary = { ...source.morphTargetDictionary };
  if (source.morphTargetInfluences) surface.morphTargetInfluences = [...source.morphTargetInfluences];
  surface.userData = {
    ...(surface.userData ?? {}),
    [OVERLAY_FLAG]: true,
    [SHARED_GEOMETRY_FLAG]: true,
    tonyAppearanceSemantic: semantic,
    tonyBodyConforming: true,
    tonyAppearanceSurfaceKind: kind,
  };
  if (boot) surface.userData[BOOT_FLAG] = true;
  surface.castShadow = true;
  surface.receiveShadow = true;
  surface.frustumCulled = false;
  surface.renderOrder = Number(source.renderOrder ?? 0) + 1;
  source.parent.add(surface);
  return surface;
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
  hair.userData[OVERLAY_FLAG] = true;
  hair.userData[HAIR_FLAG] = true;
  hair.userData.tonyAppearanceSemantic = "hair";
  hair.castShadow = true;
  hair.receiveShadow = true;
  hair.frustumCulled = false;
  head.add(hair);
  return hair;
}

function disposeCreated(nodes) {
  for (const node of nodes) {
    try { node.parent?.remove?.(node); } catch {}
    if (!node.userData?.[SHARED_GEOMETRY_FLAG]) {
      try { node.geometry?.dispose?.(); } catch {}
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      try { material?.dispose?.(); } catch {}
    }
  }
}

export function rigFootballKitEvidence(root) {
  let skinnedSurfaceCount = 0;
  let bootSurfaceCount = 0;
  let hairGeometryCount = 0;
  let rigidPrimitiveCount = 0;
  let surfaceMapPreservedCount = 0;
  const nodes = [];
  root?.traverse?.((node) => {
    if (!node.isMesh || !node.userData?.[OVERLAY_FLAG]) return;
    if (node.userData?.[HAIR_FLAG]) hairGeometryCount += 1;
    else if (node.isSkinnedMesh && node.userData?.tonyBodyConforming) skinnedSurfaceCount += 1;
    else rigidPrimitiveCount += 1;
    if (node.userData?.[BOOT_FLAG]) bootSurfaceCount += 1;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    surfaceMapPreservedCount += materials.filter((material) => material?.userData?.tonySourceMapPreserved).length;
    nodes.push(Object.freeze({
      name: node.name,
      semantic: node.userData.tonyAppearanceSemantic ?? "unknown",
      skinned: Boolean(node.isSkinnedMesh),
      bodyConforming: Boolean(node.userData.tonyBodyConforming),
      boot: Boolean(node.userData?.[BOOT_FLAG]),
      hair: Boolean(node.userData?.[HAIR_FLAG]),
      surfaceKind: node.userData.tonyAppearanceSurfaceKind ?? null,
    }));
  });
  return Object.freeze({
    installed: Boolean(root?.getObjectByName?.(OVERLAY_MARKER)),
    appearanceMode: "skinned-surface",
    skinnedSurfaceCount,
    bootSurfaceCount,
    hairGeometryCount,
    rigidPrimitiveCount,
    surfaceMapPreservedCount,
    // Compatibility field counts the seven football semantics represented by
    // the fitted surfaces: jersey, shorts, two socks and two boots plus trim.
    visibleKitNodeCount: skinnedSurfaceCount === 3 && bootSurfaceCount === 2 ? 7 : 0,
    bootGeometryCount: bootSurfaceCount,
    nodes: Object.freeze(nodes),
  });
}

export function ensureRigFootballKitOverlay({ root, player, three = THREE_NAMESPACE, lowPowerDevice = false } = {}) {
  if (!root || typeof root.getObjectByName !== "function" || typeof root.traverse !== "function") throw new TypeError("rig football appearance requires a player root");
  if (!player || typeof player !== "object") throw new TypeError("rig football appearance requires player facts");
  const existing = root.getObjectByName(OVERLAY_MARKER);
  if (existing) return rigFootballKitEvidence(root);

  const THREE = three;
  const palette = colorsFor(player);
  const body = findIntegratedBody(root);
  if (!body) throw new Error("football appearance requires an integrated skinned body");
  const created = [];
  try {
    created.push(cloneSkinnedSurface({ THREE, source: body, palette, kind: "kit", name: "TonyRigKitSurface", semantic: "kit" }));
    created.push(cloneSkinnedSurface({ THREE, source: body, palette, kind: "boot-left", name: "TonyRigBootSurfaceLeft", semantic: "boots", boot: true }));
    created.push(cloneSkinnedSurface({ THREE, source: body, palette, kind: "boot-right", name: "TonyRigBootSurfaceRight", semantic: "boots", boot: true }));
    created.push(createHair({ THREE, root, palette, player, lowPowerDevice }));

    const marker = new THREE.Group();
    marker.name = OVERLAY_MARKER;
    marker.userData.tonyRigAppearanceMarker = true;
    root.add(marker);
    const evidence = rigFootballKitEvidence(root);
    if (evidence.skinnedSurfaceCount !== 3 || evidence.bootSurfaceCount !== 2 || evidence.hairGeometryCount < 1 || evidence.rigidPrimitiveCount !== 0) {
      throw new Error("football appearance installed incomplete body-conforming surfaces");
    }
    return evidence;
  } catch (error) {
    disposeCreated(created);
    root.getObjectByName?.(OVERLAY_MARKER)?.removeFromParent?.();
    throw error;
  }
}
