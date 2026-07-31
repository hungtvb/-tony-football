import * as THREE_NAMESPACE from "three";

const APPEARANCE_MARKER = "TonyRigFootballAppearanceV3";
const APPEARANCE_FLAG = "tonyRigAppearanceSurface";
const HAIR_FLAG = "tonyRigHairGeometry";
const KIT_WEIGHT_ATTRIBUTE = "tonyKitWeights";
const KIT_WEIGHT_VERSION = "rig-bone-weights-v1";
const VARIANT_COUNT = 6;
const PART = Object.freeze({ jersey: 0, shorts: 1, socks: 2, boots: 3 });

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
  const hairPalette = [0x1a120f, 0x332016, 0x0d100f, 0x50301c, 0x17110f, 0x382219];
  const bootAccentPalette = home
    ? [0xf1d47a, 0xe3b64d, 0xf4e4b2, 0xc99836, 0xf8db7b, 0xb88328]
    : [0xa9f5fb, 0x63dce8, 0xe4fdff, 0x35a8b6, 0x8be9f1, 0x1f8794];
  return Object.freeze({
    jersey: keeper ? (home ? 0x7650d6 : 0xe65348) : (home ? 0xe1bb58 : 0x32b8c8),
    jerseyLight: keeper ? (home ? 0xbca4ff : 0xffa096) : (home ? 0xffe9ae : 0xc4fbff),
    shorts: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35),
    socks: home ? 0xe9d58f : 0xb8eff3,
    boots: keeper ? 0x111218 : 0x090b0b,
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

function normalizedBoneName(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function bonePartIndex(name) {
  const normalized = normalizedBoneName(name);
  if (/(^|_)(foot|toe|ball)(_|$)/.test(normalized)) return PART.boots;
  if (/(^|_)(calf|shin|lowerleg|lower_leg)(_|$)/.test(normalized)) return PART.socks;
  if (/(^|_)(pelvis|hip|thigh|upleg|up_leg|upperleg|upper_leg)(_|$)/.test(normalized)) return PART.shorts;
  if (/(^|_)(spine|chest|clavicle|shoulder|upperarm|upper_arm)(_|$)/.test(normalized)) return PART.jersey;
  return -1;
}

function boneSide(name) {
  const normalized = normalizedBoneName(name);
  if (/(^|_)(l|left)(_|$)/.test(normalized) || normalized.endsWith("_l")) return "left";
  if (/(^|_)(r|right)(_|$)/.test(normalized) || normalized.endsWith("_r")) return "right";
  return null;
}

function attributeValue(attribute, vertexIndex, componentIndex) {
  if (!attribute) return 0;
  const getter = ["getX", "getY", "getZ", "getW"][componentIndex];
  return typeof attribute[getter] === "function" ? Number(attribute[getter](vertexIndex)) : 0;
}

function freezeCoverage(source) {
  return Object.freeze({
    jerseyVertices: Number(source.jerseyVertices || 0),
    shortsVertices: Number(source.shortsVertices || 0),
    sockVertices: Number(source.sockVertices || 0),
    bootVertices: Number(source.bootVertices || 0),
    leftBootVertices: Number(source.leftBootVertices || 0),
    rightBootVertices: Number(source.rightBootVertices || 0),
    complete: Boolean(source.complete),
  });
}

function ensureRigKitWeights(body, THREE) {
  const geometry = body?.geometry;
  const position = geometry?.getAttribute?.("position") ?? geometry?.attributes?.position;
  const skinIndex = geometry?.getAttribute?.("skinIndex") ?? geometry?.attributes?.skinIndex;
  const skinWeight = geometry?.getAttribute?.("skinWeight") ?? geometry?.attributes?.skinWeight;
  const bones = body?.skeleton?.bones ?? [];
  if (!position || !skinIndex || !skinWeight || bones.length === 0) {
    throw new Error("football appearance requires skinned position, skinIndex and skinWeight attributes");
  }

  const signature = bones.map((bone) => normalizedBoneName(bone?.name)).join("|");
  const cachedCoverage = geometry.userData?.tonyKitWeightCoverage;
  if (
    geometry.getAttribute?.(KIT_WEIGHT_ATTRIBUTE)
    && geometry.userData?.tonyKitWeightVersion === KIT_WEIGHT_VERSION
    && geometry.userData?.tonyKitBoneSignature === signature
    && cachedCoverage?.complete
  ) return freezeCoverage(cachedCoverage);

  const weights = new Float32Array(position.count * 4);
  const coverage = {
    jerseyVertices: 0,
    shortsVertices: 0,
    sockVertices: 0,
    bootVertices: 0,
    leftBootVertices: 0,
    rightBootVertices: 0,
    complete: false,
  };
  const influenceCount = Math.min(4, skinIndex.itemSize ?? 4, skinWeight.itemSize ?? 4);

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const scores = [0, 0, 0, 0];
    let leftBootWeight = 0;
    let rightBootWeight = 0;
    for (let componentIndex = 0; componentIndex < influenceCount; componentIndex += 1) {
      const weight = attributeValue(skinWeight, vertexIndex, componentIndex);
      if (!Number.isFinite(weight) || weight <= 0) continue;
      const index = Math.round(attributeValue(skinIndex, vertexIndex, componentIndex));
      const bone = bones[index];
      const partIndex = bonePartIndex(bone?.name);
      if (partIndex < 0) continue;
      scores[partIndex] += weight;
      if (partIndex === PART.boots) {
        const side = boneSide(bone?.name);
        if (side === "left") leftBootWeight += weight;
        if (side === "right") rightBootWeight += weight;
      }
    }

    for (let partIndex = 0; partIndex < 4; partIndex += 1) {
      weights[(vertexIndex * 4) + partIndex] = Math.max(0, Math.min(1, scores[partIndex]));
    }
    if (scores[PART.jersey] > .12) coverage.jerseyVertices += 1;
    if (scores[PART.shorts] > .12) coverage.shortsVertices += 1;
    if (scores[PART.socks] > .12) coverage.sockVertices += 1;
    if (scores[PART.boots] > .12) coverage.bootVertices += 1;
    if (leftBootWeight > .12) coverage.leftBootVertices += 1;
    if (rightBootWeight > .12) coverage.rightBootVertices += 1;
  }

  coverage.complete = coverage.jerseyVertices > 0
    && coverage.shortsVertices > 0
    && coverage.sockVertices > 0
    && coverage.leftBootVertices > 0
    && coverage.rightBootVertices > 0;
  if (!coverage.complete) {
    throw new Error(`football appearance rig weights incomplete: jersey=${coverage.jerseyVertices}, shorts=${coverage.shortsVertices}, socks=${coverage.sockVertices}, leftBoot=${coverage.leftBootVertices}, rightBoot=${coverage.rightBootVertices}`);
  }

  const attribute = new THREE.Float32BufferAttribute(weights, 4);
  attribute.needsUpdate = true;
  geometry.setAttribute(KIT_WEIGHT_ATTRIBUTE, attribute);
  geometry.userData = {
    ...(geometry.userData ?? {}),
    tonyKitWeightVersion: KIT_WEIGHT_VERSION,
    tonyKitBoneSignature: signature,
    tonyKitWeightCoverage: freezeCoverage(coverage),
  };
  return freezeCoverage(coverage);
}

function kitPatternShader(pattern) {
  switch (pattern) {
    case "center-stripe":
      return "bool tonyPatternAccent = tonyTorso && tonyX < 0.075;";
    case "shoulder-panel":
      return "bool tonyPatternAccent = (tonyTorso || tonySleeve) && tonyY > 0.52;";
    case "side-stripes":
      return "bool tonyPatternAccent = (tonyTorso && tonyX > 0.205) || (tonyShorts && tonyX > 0.245);";
    case "diagonal-sash":
      return "bool tonyPatternAccent = tonyTorso && abs((vTonyBodyPosition.x * 1.45) + (tonyY - 0.42)) < 0.055;";
    case "split-tone":
      return "bool tonyPatternAccent = tonyTorso && vTonyBodyPosition.x > 0.0;";
    case "chest-band":
    default:
      return "bool tonyPatternAccent = tonyTorso && tonyY > 0.40 && tonyY < 0.475;";
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
    tonyKitWeightVersion: KIT_WEIGHT_VERSION,
  };
  material.color?.set?.(0xffffff);
  material.roughness = .62;
  material.metalness = .01;
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
      .replace("#include <common>", `#include <common>
attribute vec4 ${KIT_WEIGHT_ATTRIBUTE};
varying vec3 vTonyBodyPosition;
varying vec4 vTonyKitWeights;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vTonyBodyPosition = position;
        vTonyKitWeights = ${KIT_WEIGHT_ATTRIBUTE};
        float tonyJerseyWeight = clamp(${KIT_WEIGHT_ATTRIBUTE}.x, 0.0, 1.0);
        float tonyShortsWeight = clamp(${KIT_WEIGHT_ATTRIBUTE}.y, 0.0, 1.0);
        float tonySockWeight = clamp(${KIT_WEIGHT_ATTRIBUTE}.z, 0.0, 1.0);
        float tonyBootWeight = clamp(${KIT_WEIGHT_ATTRIBUTE}.w, 0.0, 1.0);
        float tonyUpperMask = clamp(tonyJerseyWeight + (tonyShortsWeight * 0.14), 0.0, 1.0);
        float tonyTorsoMask = tonyJerseyWeight;
        float tonyLegMask = clamp(tonyShortsWeight + tonySockWeight + tonyBootWeight, 0.0, 1.0);
        transformed.y *= ${variant.height.toFixed(5)};
        transformed.x *= mix(1.0, ${variant.shoulder.toFixed(5)}, tonyUpperMask);
        transformed.x *= mix(1.0, ${variant.leg.toFixed(5)}, tonyLegMask);
        transformed.z *= mix(1.0, ${variant.torso.toFixed(5)}, tonyTorsoMask);
        transformed.x *= mix(1.0, 1.055, tonyBootWeight);
        transformed.z *= mix(1.0, 1.110, tonyBootWeight);
        float tonyLayerThickness = (tonyJerseyWeight * 0.010) + (tonyShortsWeight * 0.012) + (tonySockWeight * 0.004) + (tonyBootWeight * 0.014);
        transformed += normalize(normal) * tonyLayerThickness;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vTonyBodyPosition;
varying vec4 vTonyKitWeights;`)
      .replace("#include <map_fragment>", `#include <map_fragment>
        float tonyY = vTonyBodyPosition.y;
        float tonyX = abs(vTonyBodyPosition.x);
        float tonyZ = vTonyBodyPosition.z;
        vec4 tonyWeights = clamp(vTonyKitWeights, 0.0, 1.0);
        bool tonyBoots = tonyWeights.w >= max(max(tonyWeights.x, tonyWeights.y), tonyWeights.z) && tonyWeights.w > 0.12;
        bool tonySocks = !tonyBoots && tonyWeights.z >= max(tonyWeights.x, tonyWeights.y) && tonyWeights.z > 0.12;
        bool tonyShorts = !tonyBoots && !tonySocks && tonyWeights.y >= tonyWeights.x && tonyWeights.y > 0.12;
        bool tonyJersey = !tonyBoots && !tonySocks && !tonyShorts && tonyWeights.x > 0.12;
        bool tonySleeve = tonyJersey && tonyX > 0.18;
        bool tonyTorso = tonyJersey && !tonySleeve;
        ${kitPatternShader(variant.kitPattern)}
        bool tonyAppearanceRegion = tonyJersey || tonyShorts || tonySocks || tonyBoots;
        if (tonyAppearanceRegion) {
          vec3 tonyTone = ${paletteSource.jersey};
          if (tonyBoots) {
            bool tonyBootSole = tonyY < -0.91 || tonyZ > 0.095;
            bool tonyBootLaces = tonyZ > 0.035 && tonyX < 0.21 && tonyY > -0.94;
            tonyTone = (tonyBootSole || tonyBootLaces) ? ${paletteSource.bootAccent} : ${paletteSource.boots};
          } else if (tonySocks) {
            bool tonySockBand = tonyY > -0.63 && tonyY < -0.56;
            tonyTone = tonySockBand ? ${paletteSource.accent} : ${paletteSource.socks};
          } else if (tonyShorts) {
            bool tonyShortAccent = tonyX > 0.255;
            tonyTone = tonyShortAccent ? ${paletteSource.accent} : ${paletteSource.shorts};
          } else if (tonyPatternAccent || (tonySleeve && tonyX > 0.42)) {
            tonyTone = ${paletteSource.accent};
          } else if (tonyTorso && tonyY > 0.62 && tonyX < 0.17) {
            tonyTone = ${paletteSource.jerseyLight};
          }
          float tonySourceLight = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.08, 1.0);
          float tonyMaterialLight = mix(0.84, 1.08, tonySourceLight);
          if (tonyBoots) tonyMaterialLight = mix(0.72, 1.02, tonySourceLight);
          diffuseColor.rgb = tonyTone * tonyMaterialLight;
        }
      `);
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}|tony-player-v3-rigweights-${variantIndex}-${variant.name}-${variant.kitPattern}-${palette.jersey}-${palette.shorts}-${palette.socks}-${palette.boots}`;
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
  mesh.renderOrder = 1;
  return mesh;
}

function createHair({ THREE, root, palette, variant, variantIndex, lowPowerDevice }) {
  const head = root.getObjectByName("Head");
  if (!head) throw new Error("football appearance requires bone Head");
  const segments = lowPowerDevice ? 10 : 18;
  const verticalSegments = lowPowerDevice ? 7 : 10;
  const material = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: .78, metalness: 0 });
  material.name = "TonyPlayerV3HairMaterial";
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
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
  const spherePiece = (radius, name, width = segments, height = verticalSegments) => createHairMesh(
    THREE,
    new THREE.SphereGeometry(radius, width, height),
    material,
    name,
  );
  const cap = () => createHairMesh(
    THREE,
    new THREE.SphereGeometry(.149, segments, verticalSegments, 0, Math.PI * 2, 0, Math.PI * .60),
    material,
    "TonyPlayerV3Hair",
  );

  switch (variant.hairStyle) {
    case "fade":
      add(cap(), [0, .096, -.006], [1.01, .72, .98]);
      add(spherePiece(.085, "TonyPlayerV3HairTop"), [0, .164, -.018], [1.35, .48, 1.08], [-.08, 0, 0]);
      break;
    case "curly": {
      add(cap(), [0, .098, -.004], [1.03, .83, 1.0]);
      const curls = [
        [-.082, .182, -.025], [0, .204, -.045], [.082, .182, -.025],
        [-.048, .19, .055], [.048, .19, .055],
      ];
      curls.forEach(([x, y, z], index) => add(
        createHairMesh(THREE, new THREE.DodecahedronGeometry(.047, 0), material, `TonyPlayerV3Curl${index + 1}`),
        [x, y, z],
        [1, .82, 1],
      ));
      break;
    }
    case "quiff":
      add(cap(), [0, .097, -.006], [1.02, .78, .98]);
      add(spherePiece(.075, "TonyPlayerV3HairQuiffLeft"), [-.042, .177, -.072], [1.18, .52, .82], [-.20, 0, -.10]);
      add(spherePiece(.078, "TonyPlayerV3HairQuiffRight"), [.045, .185, -.066], [1.22, .55, .86], [-.24, 0, .12]);
      break;
    case "buzz":
      add(cap(), [0, .088, -.004], [1.01, .58, .97]);
      break;
    case "mohawk":
      add(cap(), [0, .088, -.004], [1.0, .56, .96]);
      [-.09, -.03, .03, .09].forEach((z, index) => add(
        createHairMesh(THREE, new THREE.ConeGeometry(.027, .115, lowPowerDevice ? 5 : 7), material, `TonyPlayerV3HairMohawk${index + 1}`),
        [0, .184 + (index % 2) * .008, z],
        [1, 1, 1],
      ));
      break;
    case "crop":
    default:
      add(cap(), [0, .099, -.005], [1.02, .84, .98]);
      add(spherePiece(.068, "TonyPlayerV3HairFringe"), [0, .165, -.084], [1.42, .42, .72], [-.18, 0, 0]);
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

function appearanceCoverage(body) {
  return freezeCoverage(body?.userData?.tonyAppearanceCoverage ?? body?.geometry?.userData?.tonyKitWeightCoverage ?? {});
}

export function rigFootballKitEvidence(root) {
  const body = findIntegratedBody(root);
  const bodyOwned = Boolean(body?.userData?.[APPEARANCE_FLAG] && body?.userData?.tonyPlayerV3IntegratedAppearance);
  const coverage = appearanceCoverage(body);
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
      bootRegions: isBody ? Number(coverage.leftBootVertices > 0) + Number(coverage.rightBootVertices > 0) : 0,
      kitRegions: isBody ? 4 : 0,
      hair: isHair,
      surfaceKind: node.userData.tonyAppearanceSurfaceKind ?? null,
      variantIndex: node.userData.tonyPlayerV3VariantIndex ?? body?.userData?.tonyPlayerV3VariantIndex ?? null,
      variantName: node.userData.tonyPlayerV3VariantName ?? body?.userData?.tonyPlayerV3VariantName ?? null,
      hairStyle: node.userData.tonyPlayerV3HairStyle ?? null,
      kitPattern: node.userData.tonyPlayerV3KitPattern ?? body?.userData?.tonyPlayerV3KitPattern ?? null,
      coverage: isBody ? coverage : null,
    }));
  });
  const bootRegionCount = Number(coverage.leftBootVertices > 0) + Number(coverage.rightBootVertices > 0);
  const markerInstalled = Boolean(root?.getObjectByName?.(APPEARANCE_MARKER));
  const installed = Boolean(markerInstalled && bodyOwned && coverage.complete && hairGeometryCount >= 1);
  return Object.freeze({
    installed,
    appearanceMode: "player-v3-integrated-body-material",
    variantIndex: body?.userData?.tonyPlayerV3VariantIndex ?? null,
    variantName: body?.userData?.tonyPlayerV3VariantName ?? null,
    kitPattern: body?.userData?.tonyPlayerV3KitPattern ?? null,
    hairStyle: body?.userData?.tonyPlayerV3HairStyle ?? null,
    skinnedSurfaceCount: bodyOwned ? 1 : 0,
    integratedBodySurfaceCount: bodyOwned ? 1 : 0,
    bootSurfaceCount: bootRegionCount,
    bootRegionCount,
    hairGeometryCount,
    rigidPrimitiveCount,
    surfaceMapPreservedCount,
    visibleKitNodeCount: installed ? 7 : 0,
    bootGeometryCount: bootRegionCount,
    kitCoverageComplete: coverage.complete,
    kitCoverage: coverage,
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
  const coverage = ensureRigKitWeights(body, THREE);
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
      tonyKitRegionCount: 4,
      tonyAppearanceCoverage: coverage,
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
    if (
      evidence.skinnedSurfaceCount !== 1
      || !evidence.kitCoverageComplete
      || evidence.bootRegionCount !== 2
      || evidence.hairGeometryCount < 1
      || evidence.rigidPrimitiveCount !== 0
    ) throw new Error("football appearance installed incomplete Player V3 material");
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
