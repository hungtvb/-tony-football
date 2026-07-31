import * as THREE_NAMESPACE from "three";

const APPEARANCE_MARKER = "TonyRigFootballAppearanceV3";
const APPEARANCE_FLAG = "tonyRigAppearanceSurface";
const HAIR_FLAG = "tonyRigHairGeometry";
const VARIANT_COUNT = 6;

const BODY_VARIANTS = Object.freeze([
  Object.freeze({ name: "balanced", shoulder: 1.00, torso: 1.00, leg: 1.00, height: 1.00, hairStyle: "crop", kitPattern: "chest-band" }),
  Object.freeze({ name: "tall-lean", shoulder: 0.94, torso: 0.94, leg: 0.97, height: 1.035, hairStyle: "fade", kitPattern: "center-stripe" }),
  Object.freeze({ name: "compact-strong", shoulder: 1.08, torso: 1.07, leg: 1.04, height: 0.985, hairStyle: "curly", kitPattern: "shoulder-panel" }),
  Object.freeze({ name: "wide-athletic", shoulder: 1.11, torso: 1.02, leg: 1.01, height: 1.005, hairStyle: "quiff", kitPattern: "side-stripes" }),
  Object.freeze({ name: "slim-quick", shoulder: 0.96, torso: 0.92, leg: 0.96, height: 1.015, hairStyle: "buzz", kitPattern: "diagonal-sash" }),
  Object.freeze({ name: "power-forward", shoulder: 1.06, torso: 1.09, leg: 1.06, height: 1.02, hairStyle: "mohawk", kitPattern: "split-tone" }),
]);

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function variantIndexFor(player) {
  const explicitIndex = Number(player?.index);
  if (Number.isInteger(explicitIndex) && explicitIndex >= 0) return explicitIndex % VARIANT_COUNT;
  return stableHash(player?.id ?? `${player?.team ?? 0}:${player?.role ?? "FW"}`) % VARIANT_COUNT;
}

function colorsFor(player, variantIndex) {
  const home = Number(player?.team ?? 0) === 0;
  const keeper = player?.role === "GK";
  const hairPalette = [0x231914, 0x3b251a, 0x121514, 0x5a351f, 0x1d1714, 0x402a20];
  const bootAccentPalette = home
    ? [0xf1d47a, 0xe3b64d, 0xf4e4b2, 0xc99836, 0xf8db7b, 0xb88328]
    : [0xa9f5fb, 0x63dce8, 0xe4fdff, 0x35a8b6, 0x8be9f1, 0x1f8794];
  return Object.freeze({
    jersey: keeper ? (home ? 0x7650d6 : 0xe65348) : (home ? 0xe1bb58 : 0x32b8c8),
    jerseyLight: keeper ? (home ? 0xbca4ff : 0xffa096) : (home ? 0xffe9ae : 0xc4fbff),
    shorts: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35),
    socks: home ? 0xe9d58f : 0xb8eff3,
    boots: keeper ? 0x18191f : 0x101312,
    bootAccent: bootAccentPalette[variantIndex],
    accent: home ? 0x151a18 : 0xe8fbfb,
    hair: hairPalette[(variantIndex + Number(player?.team ?? 0)) % hairPalette.length],
  });
}

function shaderColor(THREE, value) {
  const color = new THREE.Color(value);
  return `vec3(${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)})`;
}

function materialsOf(node) {
  if (!node?.material) return [];
  return Array.isArray(node.material) ? node.material : [node.material];
}

function kitPatternShader(pattern) {
  switch (pattern) {
    case "center-stripe":
      return "bool tonyPatternAccent = tonyTorso && tonyX < 0.075;";
    case "shoulder-panel":
      return "bool tonyPatternAccent = (tonyTorso || tonySleeve) && tonyY > 0.54;";
    case "side-stripes":
      return "bool tonyPatternAccent = (tonyTorso && tonyX > 0.205) || (tonyShorts && tonyX > 0.245);";
    case "diagonal-sash":
      return "bool tonyPatternAccent = tonyTorso && abs((vTonyBodyPosition.x * 1.45) + (tonyY - 0.42)) < 0.055;";
    case "split-tone":
      return "bool tonyPatternAccent = tonyTorso && vTonyBodyPosition.x > 0.0;";
    case "chest-band":
    default:
      return "bool tonyPatternAccent = tonyTorso && tonyY > 0.42 && tonyY < 0.475;";
  }
}

function createIntegratedAppearanceMaterial(THREE, source, palette, variant, variantIndex) {
  const material = source?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, metalness: .01 });
  const previousCompile = typeof material.onBeforeCompile === "function" ? material.onBeforeCompile.bind(material) : null;
  const previousCacheKey = typeof material.customProgramCacheKey === "function" ? material.customProgramCacheKey.bind(material) : () => "";
  const sourceMap = source?.map ?? null;
  material.name = "TonyPlayerV3IntegratedAppearanceMaterial";
  material.userData = {
    ...(material.userData ?? {}),
    tonyOwnedRigAppearanceMaterial: true,
    tonySharedTextures: true,
    tonySourceMapPreserved: Boolean(sourceMap && material.map === sourceMap),
    tonyAppearanceSemantic: "integrated-appearance",
    tonyAppearanceSurfaceKind: "player-v3-integrated-body-material",
    tonyPlayerV3VariantIndex: variantIndex,
    tonyPlayerV3VariantName: variant.name,
    tonyPlayerV3KitPattern: variant.kitPattern,
  };
  material.color?.set?.(0xffffff);
  material.roughness = .58;
  material.metalness = .015;
  material.onBeforeCompile = (shader) => {
    previousCompile?.(shader);
    const paletteSource = {
      jersey: shaderColor(THREE, palette.jersey),
      jerseyLight: shaderColor(THREE, palette.jerseyLight),
      shorts: shaderColor(THREE, palette.shorts),
      socks: shaderColor(THREE, palette.socks),
      boots: shaderColor(THREE, palette.boots),
      bootAccent: shaderColor(THREE, palette.bootAccent),
      accent: shaderColor(THREE, palette.accent),
    };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTonyBodyPosition;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vTonyBodyPosition = position;
        float tonyUpperMask = smoothstep(0.18, 0.62, position.y);
        float tonyTorsoMask = smoothstep(-0.06, 0.18, position.y) * (1.0 - smoothstep(0.66, 0.88, position.y));
        float tonyLegMask = 1.0 - smoothstep(-0.18, 0.08, position.y);
        transformed.y *= ${variant.height.toFixed(5)};
        transformed.x *= mix(1.0, ${variant.shoulder.toFixed(5)}, tonyUpperMask);
        transformed.x *= mix(1.0, ${variant.leg.toFixed(5)}, tonyLegMask);
        transformed.z *= mix(1.0, ${variant.torso.toFixed(5)}, tonyTorsoMask);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTonyBodyPosition;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        float tonyY = vTonyBodyPosition.y;
        float tonyX = abs(vTonyBodyPosition.x);
        float tonyZ = vTonyBodyPosition.z;
        bool tonyTorso = tonyY > 0.15 && tonyY < 0.69 && tonyX < 0.285;
        bool tonySleeve = tonyY > 0.48 && tonyY < 0.70 && tonyX >= 0.18 && tonyX < 0.50;
        bool tonyShorts = tonyY > -0.08 && tonyY < 0.20 && tonyX < 0.33;
        bool tonySocks = tonyY >= -0.85 && tonyY < -0.54;
        bool tonyBoots = tonyY < -0.82;
        ${kitPatternShader(variant.kitPattern)}
        bool tonyAppearanceRegion = tonyTorso || tonySleeve || tonyShorts || tonySocks || tonyBoots;
        if (tonyAppearanceRegion) {
          vec3 tonyTone = ${paletteSource.jersey};
          if (tonyBoots) {
            bool tonyBootSole = tonyY < -0.91 || tonyZ > 0.095;
            tonyTone = tonyBootSole ? ${paletteSource.bootAccent} : ${paletteSource.boots};
          } else if (tonySocks) {
            bool tonySockBand = tonyY > -0.61 && tonyY < -0.57;
            tonyTone = tonySockBand ? ${paletteSource.accent} : ${paletteSource.socks};
          } else if (tonyShorts) {
            bool tonyShortAccent = tonyX > 0.255;
            tonyTone = tonyShortAccent ? ${paletteSource.accent} : ${paletteSource.shorts};
          } else if (tonyPatternAccent || (tonySleeve && tonyX > 0.445)) {
            tonyTone = ${paletteSource.accent};
          } else if (tonyTorso && tonyY > 0.625 && tonyX < 0.16) {
            tonyTone = ${paletteSource.jerseyLight};
          }
          float tonyDetail = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.18, 1.22);
          diffuseColor.rgb = tonyTone * mix(0.70, 1.20, tonyDetail);
        }
      `);
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}|tony-player-v3-${variantIndex}-${variant.name}-${variant.kitPattern}-${palette.jersey}-${palette.shorts}-${palette.socks}-${palette.boots}`;
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

function createHairMesh(THREE, geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData[APPEARANCE_FLAG] = true;
  mesh.userData[HAIR_FLAG] = true;
  mesh.userData.tonyAppearanceSemantic = "hair";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function createHair({ THREE, root, palette, variant, variantIndex, lowPowerDevice }) {
  const head = root.getObjectByName("Head");
  if (!head) throw new Error("football appearance requires bone Head");
  const segments = lowPowerDevice ? 8 : 14;
  const material = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: .88, metalness: 0 });
  material.name = "TonyPlayerV3HairMaterial";
  material.userData.tonyOwnedRigAppearanceMaterial = true;
  material.userData.tonyPlayerV3HairStyle = variant.hairStyle;
  const meshes = [];
  const add = (mesh, position, scale, rotation = [0, 0, 0]) => {
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.userData.tonyPlayerV3VariantIndex = variantIndex;
    mesh.userData.tonyPlayerV3HairStyle = variant.hairStyle;
    head.add(mesh);
    meshes.push(mesh);
  };

  const cap = () => createHairMesh(
    THREE,
    new THREE.SphereGeometry(.137, segments, lowPowerDevice ? 5 : 7, 0, Math.PI * 2, 0, Math.PI * .50),
    material,
    "TonyPlayerV3Hair",
  );

  switch (variant.hairStyle) {
    case "fade":
      add(cap(), [0, .095, -.004], [.98, .70, .94]);
      add(createHairMesh(THREE, new THREE.BoxGeometry(.13, .045, .17, 2, 1, 2), material, "TonyPlayerV3HairTop"), [0, .152, -.012], [1, 1, 1], [-.10, 0, 0]);
      break;
    case "curly":
      add(cap(), [0, .102, -.002], [1.04, .92, .98]);
      if (!lowPowerDevice) {
        for (const [index, x] of [-.075, 0, .075].entries()) {
          add(createHairMesh(THREE, new THREE.SphereGeometry(.045, 7, 5), material, `TonyPlayerV3Curl${index + 1}`), [x, .185, -.01], [1, .85, 1]);
        }
      }
      break;
    case "quiff":
      add(cap(), [0, .098, -.006], [1.00, .82, .96]);
      add(createHairMesh(THREE, new THREE.BoxGeometry(.16, .055, .12, 2, 1, 2), material, "TonyPlayerV3HairQuiff"), [0, .17, -.05], [1, 1, 1], [-.24, 0, 0]);
      break;
    case "buzz":
      add(cap(), [0, .088, -.003], [1.00, .54, .95]);
      break;
    case "mohawk":
      add(cap(), [0, .088, -.004], [.98, .58, .93]);
      add(createHairMesh(THREE, new THREE.BoxGeometry(.045, .105, .22, 1, 2, 3), material, "TonyPlayerV3HairMohawk"), [0, .165, -.005], [1, 1, 1], [.04, 0, 0]);
      break;
    case "crop":
    default:
      add(cap(), [0, .102, -.004], [.98, .90, .94]);
      break;
  }
  return meshes;
}

function disposeMaterials(materials) {
  for (const material of materials ?? []) {
    try { material?.dispose?.(); } catch {}
  }
}

function disposeHair(meshes) {
  const materials = new Set();
  for (const mesh of meshes ?? []) {
    try { mesh.parent?.remove?.(mesh); } catch {}
    try { mesh.geometry?.dispose?.(); } catch {}
    for (const material of materialsOf(mesh)) materials.add(material);
  }
  disposeMaterials(materials);
}

export function rigFootballKitEvidence(root) {
  const body = findIntegratedBody(root);
  const bodyOwned = Boolean(body?.userData?.[APPEARANCE_FLAG] && body?.userData?.tonyPlayerV3IntegratedAppearance);
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
      variantIndex: node.userData.tonyPlayerV3VariantIndex ?? body?.userData?.tonyPlayerV3VariantIndex ?? null,
      variantName: node.userData.tonyPlayerV3VariantName ?? body?.userData?.tonyPlayerV3VariantName ?? null,
      hairStyle: node.userData.tonyPlayerV3HairStyle ?? null,
      kitPattern: node.userData.tonyPlayerV3KitPattern ?? body?.userData?.tonyPlayerV3KitPattern ?? null,
    }));
  });
  const installed = Boolean(root?.getObjectByName?.(APPEARANCE_MARKER) && bodyOwned);
  return Object.freeze({
    installed,
    appearanceMode: "player-v3-integrated-body-material",
    variantIndex: body?.userData?.tonyPlayerV3VariantIndex ?? null,
    variantName: body?.userData?.tonyPlayerV3VariantName ?? null,
    kitPattern: body?.userData?.tonyPlayerV3KitPattern ?? null,
    hairStyle: body?.userData?.tonyPlayerV3HairStyle ?? null,
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
  const variantIndex = variantIndexFor(player);
  const variant = BODY_VARIANTS[variantIndex];
  const palette = colorsFor(player, variantIndex);
  const body = findIntegratedBody(root);
  if (!body) throw new Error("football appearance requires an integrated skinned body");
  if (!root.getObjectByName("Head")) throw new Error("football appearance requires bone Head");
  const originalMaterial = body.material;
  const originalUserData = { ...(body.userData ?? {}) };
  const createdMaterials = materialsOf(body).map((material) => createIntegratedAppearanceMaterial(THREE, material, palette, variant, variantIndex));
  let hairMeshes = [];
  let marker = null;
  try {
    body.material = Array.isArray(originalMaterial) ? createdMaterials : createdMaterials[0];
    body.userData = {
      ...originalUserData,
      [APPEARANCE_FLAG]: true,
      tonyPlayerV3IntegratedAppearance: true,
      tonyBodyConforming: true,
      tonyAppearanceSemantic: "integrated-appearance",
      tonyAppearanceSurfaceKind: "player-v3-integrated-body-material",
      tonyBootRegionCount: 2,
      tonyKitRegionCount: 5,
      tonyPlayerV3VariantIndex: variantIndex,
      tonyPlayerV3VariantName: variant.name,
      tonyPlayerV3KitPattern: variant.kitPattern,
      tonyPlayerV3HairStyle: variant.hairStyle,
    };
    hairMeshes = createHair({ THREE, root, palette, variant, variantIndex, lowPowerDevice });
    marker = new THREE.Group();
    marker.name = APPEARANCE_MARKER;
    marker.userData.tonyPlayerV3AppearanceMarker = true;
    marker.userData.tonyPlayerV3VariantIndex = variantIndex;
    root.add(marker);
    const evidence = rigFootballKitEvidence(root);
    if (evidence.skinnedSurfaceCount !== 1 || evidence.bootRegionCount !== 2 || evidence.hairGeometryCount < 1 || evidence.rigidPrimitiveCount !== 0) throw new Error("football appearance installed incomplete Player V3 material");
    return evidence;
  } catch (error) {
    marker?.removeFromParent?.();
    disposeHair(hairMeshes);
    body.material = originalMaterial;
    body.userData = originalUserData;
    disposeMaterials(createdMaterials);
    throw error;
  }
}
