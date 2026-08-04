import * as THREE_NAMESPACE from "three";

const APPEARANCE_MARKER = "TonyRigFootballAppearanceV3";
const APPEARANCE_FLAG = "tonyRigAppearanceSurface";
const HAIR_FLAG = "tonyRigHairGeometry";
const BOOT_FLAG = "tonyRigBootSilhouette";
const KIT_WEIGHT_ATTRIBUTE = "tonyKitWeights";
const KIT_WEIGHT_VERSION = "rig-bone-weights-v2";
const VARIANT_COUNT = 6;
const PART = Object.freeze({ jersey: 0, shorts: 1, socks: 2, boots: 3 });

const BODY_VARIANTS = Object.freeze([
  Object.freeze({ name: "balanced", shoulder: 1.00, torso: 1.00, leg: 1.00, height: 1.00, hairStyle: "crop", kitPattern: "chest-band" }),
  Object.freeze({ name: "tall-lean", shoulder: 0.97, torso: 0.96, leg: 0.99, height: 1.025, hairStyle: "fade", kitPattern: "center-stripe" }),
  Object.freeze({ name: "compact-strong", shoulder: 1.045, torso: 1.035, leg: 1.015, height: 0.99, hairStyle: "curly", kitPattern: "shoulder-panel" }),
  Object.freeze({ name: "wide-athletic", shoulder: 1.06, torso: 1.02, leg: 1.01, height: 1.005, hairStyle: "quiff", kitPattern: "side-stripes" }),
  Object.freeze({ name: "slim-quick", shoulder: 0.975, torso: 0.95, leg: 0.985, height: 1.015, hairStyle: "buzz", kitPattern: "diagonal-sash" }),
  Object.freeze({ name: "power-forward", shoulder: 1.05, torso: 1.045, leg: 1.02, height: 1.015, hairStyle: "mohawk", kitPattern: "split-tone" }),
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

function isHeadBone(name) {
  return /(^|_)(head|skull)(_|$)/.test(normalizedBoneName(name));
}

function isToeBone(name) {
  return /(^|_)(toe|ball)(_|$)/.test(normalizedBoneName(name));
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

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - (2 * t));
}

function softWindow(value, low, high, feather = .035) {
  return smoothstep(low - feather, low + feather, value) * (1 - smoothstep(high - feather, high + feather, value));
}

function createMutableBounds() {
  return {
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
    count: 0,
  };
}

function includeBounds(bounds, x, y, z) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.maxZ = Math.max(bounds.maxZ, z);
  bounds.count += 1;
}

function freezeBounds(bounds) {
  if (!bounds || bounds.count <= 0 || !Number.isFinite(bounds.minX)) return null;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const depth = bounds.maxZ - bounds.minZ;
  return Object.freeze({
    minX: bounds.minX, minY: bounds.minY, minZ: bounds.minZ,
    maxX: bounds.maxX, maxY: bounds.maxY, maxZ: bounds.maxZ,
    centerX: (bounds.minX + bounds.maxX) * .5,
    centerY: (bounds.minY + bounds.maxY) * .5,
    centerZ: (bounds.minZ + bounds.maxZ) * .5,
    width, height, depth,
    count: bounds.count,
  });
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

function freezeRigMetrics(source) {
  return Object.freeze({
    coverage: freezeCoverage(source.coverage ?? {}),
    bodyBounds: source.bodyBounds ?? null,
    headBounds: source.headBounds ?? null,
    leftFootBounds: source.leftFootBounds ?? null,
    rightFootBounds: source.rightFootBounds ?? null,
    leftToeCenter: source.leftToeCenter ?? null,
    rightToeCenter: source.rightToeCenter ?? null,
    measuredHeadBounds: Boolean(source.measuredHeadBounds),
  });
}

function boneIndexMatching(bones, predicate, side = null) {
  const index = bones.findIndex((bone) => predicate(bone?.name) && (side === null || boneSide(bone?.name) === side));
  return index >= 0 ? index : null;
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
  const cachedMetrics = geometry.userData?.tonyRigAppearanceMetrics;
  if (
    geometry.getAttribute?.(KIT_WEIGHT_ATTRIBUTE)
    && geometry.userData?.tonyKitWeightVersion === KIT_WEIGHT_VERSION
    && geometry.userData?.tonyKitBoneSignature === signature
    && cachedMetrics?.coverage?.complete
  ) return freezeRigMetrics(cachedMetrics);

  const vertexCount = position.count;
  const influenceCount = Math.min(4, skinIndex.itemSize ?? 4, skinWeight.itemSize ?? 4);
  const rawScores = new Float32Array(vertexCount * 4);
  const headWeights = new Float32Array(vertexCount);
  const leftBootWeights = new Float32Array(vertexCount);
  const rightBootWeights = new Float32Array(vertexCount);
  const leftToeWeights = new Float32Array(vertexCount);
  const rightToeWeights = new Float32Array(vertexCount);
  const bodyBoundsMutable = createMutableBounds();
  const headBoundsMutable = createMutableBounds();
  const leftFootBoundsMutable = createMutableBounds();
  const rightFootBoundsMutable = createMutableBounds();
  const leftToeBoundsMutable = createMutableBounds();
  const rightToeBoundsMutable = createMutableBounds();

  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const x = attributeValue(position, vertexIndex, 0);
    const y = attributeValue(position, vertexIndex, 1);
    const z = attributeValue(position, vertexIndex, 2);
    includeBounds(bodyBoundsMutable, x, y, z);

    for (let componentIndex = 0; componentIndex < influenceCount; componentIndex += 1) {
      const weight = attributeValue(skinWeight, vertexIndex, componentIndex);
      if (!Number.isFinite(weight) || weight <= 0) continue;
      const index = Math.round(attributeValue(skinIndex, vertexIndex, componentIndex));
      const bone = bones[index];
      const name = bone?.name ?? "";
      const partIndex = bonePartIndex(name);
      if (partIndex >= 0) rawScores[(vertexIndex * 4) + partIndex] += weight;
      if (isHeadBone(name)) headWeights[vertexIndex] += weight;
      if (partIndex === PART.boots) {
        const side = boneSide(name);
        if (side === "left") leftBootWeights[vertexIndex] += weight;
        if (side === "right") rightBootWeights[vertexIndex] += weight;
        if (isToeBone(name) && side === "left") leftToeWeights[vertexIndex] += weight;
        if (isToeBone(name) && side === "right") rightToeWeights[vertexIndex] += weight;
      }
    }

    if (headWeights[vertexIndex] > .16) includeBounds(headBoundsMutable, x, y, z);
    if (leftBootWeights[vertexIndex] > .10) includeBounds(leftFootBoundsMutable, x, y, z);
    if (rightBootWeights[vertexIndex] > .10) includeBounds(rightFootBoundsMutable, x, y, z);
    if (leftToeWeights[vertexIndex] > .10) includeBounds(leftToeBoundsMutable, x, y, z);
    if (rightToeWeights[vertexIndex] > .10) includeBounds(rightToeBoundsMutable, x, y, z);
  }

  const bodyBounds = freezeBounds(bodyBoundsMutable);
  const measuredHeadBounds = freezeBounds(headBoundsMutable);
  if (!bodyBounds || bodyBounds.height <= 0) throw new Error("football appearance requires finite body rest-space bounds");
  const headBounds = measuredHeadBounds ?? Object.freeze({
    minX: bodyBounds.centerX - (bodyBounds.height * .065),
    maxX: bodyBounds.centerX + (bodyBounds.height * .065),
    minY: bodyBounds.maxY - (bodyBounds.height * .19),
    maxY: bodyBounds.maxY,
    minZ: bodyBounds.centerZ - (bodyBounds.height * .07),
    maxZ: bodyBounds.centerZ + (bodyBounds.height * .07),
    centerX: bodyBounds.centerX,
    centerY: bodyBounds.maxY - (bodyBounds.height * .095),
    centerZ: bodyBounds.centerZ,
    width: bodyBounds.height * .13,
    height: bodyBounds.height * .19,
    depth: bodyBounds.height * .14,
    count: 0,
  });
  const leftFootBounds = freezeBounds(leftFootBoundsMutable);
  const rightFootBounds = freezeBounds(rightFootBoundsMutable);
  const leftToeBounds = freezeBounds(leftToeBoundsMutable);
  const rightToeBounds = freezeBounds(rightToeBoundsMutable);
  const weights = new Float32Array(vertexCount * 4);
  const coverage = {
    jerseyVertices: 0,
    shortsVertices: 0,
    sockVertices: 0,
    bootVertices: 0,
    leftBootVertices: 0,
    rightBootVertices: 0,
    complete: false,
  };
  const bodyHeight = Math.max(bodyBounds.height, 1e-6);
  const bodyWidth = Math.max(bodyBounds.width, 1e-6);
  const headStart = Math.max(.74, Math.min(.92, (headBounds.minY - bodyBounds.minY) / bodyHeight));
  const centerX = bodyBounds.centerX;

  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const x = attributeValue(position, vertexIndex, 0);
    const y = attributeValue(position, vertexIndex, 1);
    const ny = (y - bodyBounds.minY) / bodyHeight;
    const nx = Math.abs((x - centerX) / bodyWidth);
    const offset = vertexIndex * 4;
    let jersey = rawScores[offset + PART.jersey] * softWindow(ny, .47, headStart, .035);
    let shorts = rawScores[offset + PART.shorts] * softWindow(ny, .30, .59, .04);
    let socks = rawScores[offset + PART.socks] * softWindow(ny, .08, .39, .035);
    let boots = rawScores[offset + PART.boots] * softWindow(ny, -.02, .20, .035);

    if (headWeights[vertexIndex] > .10) jersey = 0;
    if (jersey < .08 && shorts < .08 && ny > .50 && ny < headStart - .02 && nx < .16) jersey = .92;
    if (shorts < .08 && ny > .36 && ny < .52 && nx < .19) shorts = .72;

    const scores = [jersey, shorts, socks, boots];
    let dominantIndex = 0;
    for (let index = 1; index < scores.length; index += 1) if (scores[index] > scores[dominantIndex]) dominantIndex = index;
    const dominant = scores[dominantIndex];
    if (dominant > .10) {
      for (let index = 0; index < scores.length; index += 1) {
        const sharpened = scores[index] * scores[index];
        scores[index] = index === dominantIndex ? Math.max(sharpened, dominant) : sharpened * .30;
      }
    }
    const sum = Math.max(1, scores.reduce((total, value) => total + value, 0));
    for (let partIndex = 0; partIndex < 4; partIndex += 1) {
      weights[offset + partIndex] = Math.max(0, Math.min(1, scores[partIndex] / sum));
    }

    if (weights[offset + PART.jersey] > .12) coverage.jerseyVertices += 1;
    if (weights[offset + PART.shorts] > .12) coverage.shortsVertices += 1;
    if (weights[offset + PART.socks] > .12) coverage.sockVertices += 1;
    if (weights[offset + PART.boots] > .12) coverage.bootVertices += 1;
    if (leftBootWeights[vertexIndex] > .10 && weights[offset + PART.boots] > .08) coverage.leftBootVertices += 1;
    if (rightBootWeights[vertexIndex] > .10 && weights[offset + PART.boots] > .08) coverage.rightBootVertices += 1;
  }

  coverage.complete = coverage.jerseyVertices > 0
    && coverage.shortsVertices > 0
    && coverage.sockVertices > 0
    && coverage.leftBootVertices > 0
    && coverage.rightBootVertices > 0;
  if (!coverage.complete) {
    throw new Error(`football appearance rig weights incomplete: jersey=${coverage.jerseyVertices}, shorts=${coverage.shortsVertices}, socks=${coverage.sockVertices}, leftBoot=${coverage.leftBootVertices}, rightBoot=${coverage.rightBootVertices}`);
  }
  if (!leftFootBounds || !rightFootBounds) throw new Error("football appearance requires measured left and right foot bounds");

  const metrics = freezeRigMetrics({
    coverage,
    bodyBounds,
    headBounds,
    leftFootBounds,
    rightFootBounds,
    leftToeCenter: leftToeBounds ? Object.freeze({ x: leftToeBounds.centerX, y: leftToeBounds.centerY, z: leftToeBounds.centerZ }) : null,
    rightToeCenter: rightToeBounds ? Object.freeze({ x: rightToeBounds.centerX, y: rightToeBounds.centerY, z: rightToeBounds.centerZ }) : null,
    measuredHeadBounds: Boolean(measuredHeadBounds),
  });
  const attribute = new THREE.Float32BufferAttribute(weights, 4);
  attribute.needsUpdate = true;
  geometry.setAttribute(KIT_WEIGHT_ATTRIBUTE, attribute);
  geometry.userData = {
    ...(geometry.userData ?? {}),
    tonyKitWeightVersion: KIT_WEIGHT_VERSION,
    tonyKitBoneSignature: signature,
    tonyKitWeightCoverage: metrics.coverage,
    tonyRigAppearanceMetrics: metrics,
  };
  return metrics;
}

function kitPatternShader(pattern) {
  switch (pattern) {
    case "center-stripe":
      return "float tonyPatternMix = (tonyTorso && tonyX < 0.055) ? 0.26 : 0.0;";
    case "shoulder-panel":
      return "float tonyPatternMix = ((tonyTorso || tonySleeve) && tonyY > 0.52 && tonyX > 0.14) ? 0.18 : 0.0;";
    case "side-stripes":
      return "float tonyPatternMix = ((tonyTorso && tonyX > 0.225) || (tonyShorts && tonyX > 0.265)) ? 0.22 : 0.0;";
    case "diagonal-sash":
      return "float tonyPatternMix = (tonyTorso && abs((vTonyBodyPosition.x * 1.45) + (tonyY - 0.42)) < 0.038) ? 0.22 : 0.0;";
    case "split-tone":
      return "float tonyPatternMix = (tonyTorso && vTonyBodyPosition.x > 0.0) ? 0.16 : 0.0;";
    case "chest-band":
    default:
      return "float tonyPatternMix = (tonyTorso && tonyY > 0.41 && tonyY < 0.455) ? 0.24 : 0.0;";
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
  material.roughness = .64;
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
        float tonyUpperMask = clamp(tonyJerseyWeight + (tonyShortsWeight * 0.08), 0.0, 1.0);
        float tonyTorsoMask = tonyJerseyWeight;
        float tonyLegMask = clamp(tonyShortsWeight + tonySockWeight, 0.0, 1.0);
        transformed.y *= ${variant.height.toFixed(5)};
        transformed.x *= mix(1.0, ${variant.shoulder.toFixed(5)}, tonyUpperMask);
        transformed.x *= mix(1.0, ${variant.leg.toFixed(5)}, tonyLegMask);
        transformed.z *= mix(1.0, ${variant.torso.toFixed(5)}, tonyTorsoMask);
        transformed.x *= mix(1.0, 1.012, tonyBootWeight);
        transformed.z *= mix(1.0, 1.018, tonyBootWeight);
        float tonyLayerThickness = (tonyJerseyWeight * 0.006) + (tonyShortsWeight * 0.007) + (tonySockWeight * 0.0025) + (tonyBootWeight * 0.002);
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
            tonyTone = ${paletteSource.boots};
          } else if (tonySocks) {
            bool tonySockBand = tonyY > -0.63 && tonyY < -0.58;
            tonyTone = tonySockBand ? mix(${paletteSource.socks}, ${paletteSource.accent}, 0.20) : ${paletteSource.socks};
          } else if (tonyShorts) {
            float tonyShortAccentMix = tonyX > 0.265 ? 0.16 : 0.0;
            tonyTone = mix(${paletteSource.shorts}, ${paletteSource.accent}, tonyShortAccentMix);
          } else {
            tonyTone = mix(${paletteSource.jersey}, ${paletteSource.accent}, tonyPatternMix);
            if (tonySleeve && tonyX > 0.42) tonyTone = mix(tonyTone, ${paletteSource.accent}, 0.14);
            if (tonyTorso && tonyY > 0.62 && tonyX < 0.13) tonyTone = mix(tonyTone, ${paletteSource.jerseyLight}, 0.12);
          }
          float tonySourceLight = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.12, 1.0);
          float tonyMaterialLight = mix(0.88, 1.06, tonySourceLight);
          if (tonyBoots) tonyMaterialLight = mix(0.70, 0.94, tonySourceLight);
          diffuseColor.rgb = tonyTone * tonyMaterialLight;
        }
      `);
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}|tony-player-v3-rigweights-v2-${variantIndex}-${variant.name}-${variant.kitPattern}-${palette.jersey}-${palette.shorts}-${palette.socks}-${palette.boots}`;
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

function createHairMesh(THREE, geometry, material, name, layer) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData[APPEARANCE_FLAG] = true;
  mesh.userData[HAIR_FLAG] = true;
  mesh.userData.tonyHairCoverageLayer = layer;
  mesh.userData.tonyAppearanceSemantic = "hair";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

function attachBodySpaceMeshToBone({ THREE, root, body, bone, mesh, position, scale, rotation = [0, 0, 0] }) {
  root.updateMatrixWorld(true);
  body.updateMatrixWorld(true);
  bone.updateMatrixWorld(true);
  const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  const localMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    localRotation,
    new THREE.Vector3(...scale),
  );
  const worldMatrix = body.matrixWorld.clone().multiply(localMatrix);
  const rootLocalMatrix = root.matrixWorld.clone().invert().multiply(worldMatrix);
  root.add(mesh);
  rootLocalMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  root.updateMatrixWorld(true);
  bone.attach(mesh);
  return mesh;
}

function createHair({ THREE, root, body, metrics, palette, variant, variantIndex, lowPowerDevice }) {
  const head = root.getObjectByName("Head");
  if (!head) throw new Error("football appearance requires bone Head");
  const bounds = metrics.headBounds;
  if (!bounds) throw new Error("football appearance requires measured or fallback head bounds");
  const segments = lowPowerDevice ? 12 : 20;
  const verticalSegments = lowPowerDevice ? 8 : 12;
  const material = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: .82, metalness: 0 });
  material.name = "TonyPlayerV3HairMaterial";
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  material.userData.tonyOwnedRigAppearanceMaterial = true;
  material.userData.tonyPlayerV3HairStyle = variant.hairStyle;
  const meshes = [];
  const add = (geometry, name, layer, position, scale, rotation = [0, 0, 0]) => {
    const mesh = createHairMesh(THREE, geometry, material, name, layer);
    mesh.userData.tonyPlayerV3VariantIndex = variantIndex;
    mesh.userData.tonyPlayerV3HairStyle = variant.hairStyle;
    mesh.userData.tonyMeasuredHeadBounds = metrics.measuredHeadBounds;
    attachBodySpaceMeshToBone({ THREE, root, body, bone: head, mesh, position, scale, rotation });
    meshes.push(mesh);
    return mesh;
  };

  const headWidth = Math.max(bounds.width, metrics.bodyBounds.height * .105);
  const headHeight = Math.max(bounds.height, metrics.bodyBounds.height * .145);
  const headDepth = Math.max(bounds.depth, metrics.bodyBounds.height * .115);
  const capCenter = [bounds.centerX, bounds.minY + (headHeight * .61), bounds.centerZ + (headDepth * .015)];
  add(
    new THREE.SphereGeometry(.5, segments, verticalSegments, 0, Math.PI * 2, 0, Math.PI * .76),
    "TonyPlayerV3Hair",
    "scalp-cap",
    capCenter,
    [headWidth * 1.10, headHeight * .80, headDepth * 1.11],
  );
  add(
    new THREE.SphereGeometry(.5, segments, verticalSegments),
    "TonyPlayerV3HairCrown",
    "crown",
    [bounds.centerX, bounds.minY + (headHeight * .80), bounds.centerZ + (headDepth * .015)],
    [headWidth * .88, headHeight * .34, headDepth * .90],
  );

  const frontZ = bounds.centerZ - (headDepth * .44);
  const crownY = bounds.minY + (headHeight * .84);
  const spherePiece = (radius = .5) => new THREE.SphereGeometry(radius, segments, verticalSegments);
  switch (variant.hairStyle) {
    case "fade":
      add(spherePiece(), "TonyPlayerV3HairTop", "style", [bounds.centerX, crownY, bounds.centerZ], [headWidth * .82, headHeight * .22, headDepth * .82], [-.08, 0, 0]);
      break;
    case "curly": {
      const offsets = [
        [-.28, .02, -.12], [0, .10, -.18], [.28, .02, -.12],
        [-.18, .05, .18], [.18, .05, .18],
      ];
      offsets.forEach(([x, y, z], index) => add(
        new THREE.DodecahedronGeometry(.5, 0),
        `TonyPlayerV3Curl${index + 1}`,
        "style",
        [bounds.centerX + (headWidth * x), crownY + (headHeight * y), bounds.centerZ + (headDepth * z)],
        [headWidth * .26, headHeight * .20, headDepth * .24],
      ));
      break;
    }
    case "quiff":
      add(spherePiece(), "TonyPlayerV3HairQuiffLeft", "style", [bounds.centerX - (headWidth * .14), crownY, frontZ], [headWidth * .46, headHeight * .24, headDepth * .34], [-.18, 0, -.10]);
      add(spherePiece(), "TonyPlayerV3HairQuiffRight", "style", [bounds.centerX + (headWidth * .15), crownY + (headHeight * .025), frontZ], [headWidth * .48, headHeight * .26, headDepth * .36], [-.21, 0, .12]);
      break;
    case "buzz":
      break;
    case "mohawk":
      [-.30, -.10, .10, .30].forEach((z, index) => add(
        new THREE.ConeGeometry(.5, 1, lowPowerDevice ? 6 : 8),
        `TonyPlayerV3HairMohawk${index + 1}`,
        "style",
        [bounds.centerX, crownY + (headHeight * .10), bounds.centerZ + (headDepth * z)],
        [headWidth * .15, headHeight * .42, headDepth * .15],
      ));
      break;
    case "crop":
    default:
      add(spherePiece(), "TonyPlayerV3HairFringe", "style", [bounds.centerX, crownY - (headHeight * .02), frontZ], [headWidth * .66, headHeight * .16, headDepth * .28], [-.14, 0, 0]);
      break;
  }
  return meshes;
}

function createFootballBootGeometry(THREE, bounds, toeCenter, footBoneIndex, toeBoneIndex, bodyHeight) {
  const width = Math.max(bounds.width * 1.14, bodyHeight * .044);
  const height = Math.max(bounds.height * 1.08, bodyHeight * .030);
  const length = Math.max(bounds.depth * 1.26, bodyHeight * .082);
  const centerX = bounds.centerX;
  const bottomY = bounds.minY - (height * .10);
  const topRearY = bounds.maxY + (height * .08);
  const topFrontY = bottomY + (height * .67);
  const forwardDelta = Number(toeCenter?.z) - bounds.centerZ;
  const forwardSign = Math.abs(forwardDelta) > 1e-5 ? Math.sign(forwardDelta) : -1;
  const rearZ = bounds.centerZ - (forwardSign * length * .38);
  const frontZ = bounds.centerZ + (forwardSign * length * .62);
  const halfRear = width * .5;
  const halfFront = width * .40;
  const vertices = new Float32Array([
    centerX - halfRear, bottomY, rearZ,
    centerX + halfRear, bottomY, rearZ,
    centerX - halfRear, topRearY, rearZ,
    centerX + halfRear, topRearY, rearZ,
    centerX - halfFront, bottomY, frontZ,
    centerX + halfFront, bottomY, frontZ,
    centerX - halfFront, topFrontY, frontZ,
    centerX + halfFront, topFrontY, frontZ,
  ]);
  const upperIndices = [
    2, 3, 7, 2, 7, 6,
    0, 2, 6, 0, 6, 4,
    1, 5, 7, 1, 7, 3,
    4, 6, 7, 4, 7, 5,
    0, 1, 3, 0, 3, 2,
  ];
  const soleIndices = [0, 4, 5, 0, 5, 1];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([...upperIndices, ...soleIndices]);
  geometry.clearGroups();
  geometry.addGroup(0, upperIndices.length, 0);
  geometry.addGroup(upperIndices.length, soleIndices.length, 1);
  const skinIndices = new Uint16Array(8 * 4);
  const skinWeights = new Float32Array(8 * 4);
  for (let index = 0; index < 8; index += 1) {
    skinIndices[index * 4] = index >= 4 ? (toeBoneIndex ?? footBoneIndex) : footBoneIndex;
    skinWeights[index * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.type = "TonyFootballBootGeometry";
  geometry.userData.tonyFootballBootGeometry = true;
  return geometry;
}

function createBootMeshes({ THREE, body, metrics, palette }) {
  const bones = body.skeleton?.bones ?? [];
  const upperMaterial = new THREE.MeshStandardMaterial({ color: palette.boots, roughness: .50, metalness: .03 });
  const soleMaterial = new THREE.MeshStandardMaterial({ color: palette.bootAccent, roughness: .62, metalness: .01 });
  upperMaterial.name = "TonyPlayerV3BootUpperMaterial";
  soleMaterial.name = "TonyPlayerV3BootSoleMaterial";
  upperMaterial.userData.tonyOwnedRigAppearanceMaterial = true;
  soleMaterial.userData.tonyOwnedRigAppearanceMaterial = true;
  const created = [];
  const parent = body.parent;
  if (!parent) throw new Error("football appearance requires body parent for skinned footwear");

  for (const side of ["left", "right"]) {
    const footBoneIndex = boneIndexMatching(bones, (name) => bonePartIndex(name) === PART.boots && !isToeBone(name), side)
      ?? boneIndexMatching(bones, (name) => bonePartIndex(name) === PART.boots, side);
    const toeBoneIndex = boneIndexMatching(bones, isToeBone, side);
    const bounds = side === "left" ? metrics.leftFootBounds : metrics.rightFootBounds;
    const toeCenter = side === "left" ? metrics.leftToeCenter : metrics.rightToeCenter;
    if (footBoneIndex === null || !bounds) throw new Error(`football appearance requires ${side} foot bone and bounds`);
    const geometry = createFootballBootGeometry(THREE, bounds, toeCenter, footBoneIndex, toeBoneIndex, metrics.bodyBounds.height);
    const mesh = new THREE.SkinnedMesh(geometry, [upperMaterial, soleMaterial]);
    mesh.name = side === "left" ? "TonyPlayerV3BootLeft" : "TonyPlayerV3BootRight";
    mesh.userData[APPEARANCE_FLAG] = true;
    mesh.userData[BOOT_FLAG] = true;
    mesh.userData.tonyAppearanceSemantic = "boots";
    mesh.userData.tonyAppearanceSurfaceKind = "player-v3-skinned-footwear";
    mesh.userData.tonyFootSide = side;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    mesh.scale.copy(body.scale);
    mesh.bindMode = body.bindMode;
    parent.add(mesh);
    mesh.bind(body.skeleton, body.bindMatrix);
    created.push(mesh);
  }
  return created;
}

function disposeMaterials(materials) {
  for (const material of materials ?? []) {
    try { material?.dispose?.(); } catch {}
  }
}

function disposeOwnedMeshes(meshes) {
  const materials = new Set();
  for (const mesh of meshes ?? []) {
    try { mesh.parent?.remove?.(mesh); } catch {}
    try { mesh.geometry?.dispose?.(); } catch {}
    for (const material of materialsOf(mesh)) materials.add(material);
  }
  disposeMaterials(materials);
}

function appearanceMetrics(body) {
  return freezeRigMetrics(body?.userData?.tonyAppearanceMetrics ?? body?.geometry?.userData?.tonyRigAppearanceMetrics ?? {});
}

export function rigFootballKitEvidence(root) {
  const body = findIntegratedBody(root);
  const bodyOwned = Boolean(body?.userData?.[APPEARANCE_FLAG] && body?.userData?.tonyPlayerV3IntegratedAppearance);
  const metrics = appearanceMetrics(body);
  const coverage = metrics.coverage;
  let hairGeometryCount = 0;
  let hairBaseCount = 0;
  let hairCrownCount = 0;
  let bootGeometryCount = 0;
  let rigidPrimitiveCount = 0;
  let surfaceMapPreservedCount = 0;
  const nodes = [];
  root?.traverse?.((node) => {
    if (!node.isMesh) return;
    const isBody = node === body && bodyOwned;
    const isHair = Boolean(node.userData?.[HAIR_FLAG]);
    const isBoot = Boolean(node.userData?.[BOOT_FLAG]);
    const isAppearanceNode = Boolean(node.userData?.[APPEARANCE_FLAG]);
    if (!isBody && !isHair && !isBoot && !isAppearanceNode) return;
    if (isHair) {
      hairGeometryCount += 1;
      if (node.userData?.tonyHairCoverageLayer === "scalp-cap") hairBaseCount += 1;
      if (node.userData?.tonyHairCoverageLayer === "crown") hairCrownCount += 1;
    } else if (isBoot) {
      bootGeometryCount += 1;
      if (!node.isSkinnedMesh || node.geometry?.type !== "TonyFootballBootGeometry") rigidPrimitiveCount += 1;
    } else if (!isBody) {
      rigidPrimitiveCount += 1;
    }
    const materials = materialsOf(node);
    surfaceMapPreservedCount += materials.filter((material) => material?.userData?.tonySourceMapPreserved).length;
    nodes.push(Object.freeze({
      name: node.name,
      semantic: node.userData.tonyAppearanceSemantic ?? (isBody ? "integrated-appearance" : "unknown"),
      skinned: Boolean(node.isSkinnedMesh),
      bodyConforming: Boolean(isBody || isBoot),
      integratedBody: Boolean(isBody),
      bootRegions: isBody ? Number(coverage.leftBootVertices > 0) + Number(coverage.rightBootVertices > 0) : 0,
      kitRegions: isBody ? 4 : 0,
      hair: isHair,
      boot: isBoot,
      hairCoverageLayer: node.userData?.tonyHairCoverageLayer ?? null,
      surfaceKind: node.userData.tonyAppearanceSurfaceKind ?? null,
      variantIndex: node.userData.tonyPlayerV3VariantIndex ?? body?.userData?.tonyPlayerV3VariantIndex ?? null,
      variantName: node.userData.tonyPlayerV3VariantName ?? body?.userData?.tonyPlayerV3VariantName ?? null,
      hairStyle: node.userData.tonyPlayerV3HairStyle ?? null,
      kitPattern: node.userData.tonyPlayerV3KitPattern ?? body?.userData?.tonyPlayerV3KitPattern ?? null,
      coverage: isBody ? coverage : null,
    }));
  });
  const bootRegionCount = Number(coverage.leftBootVertices > 0) + Number(coverage.rightBootVertices > 0);
  const hairCoverageComplete = hairBaseCount >= 1 && hairCrownCount >= 1;
  const markerInstalled = Boolean(root?.getObjectByName?.(APPEARANCE_MARKER));
  const installed = Boolean(markerInstalled && bodyOwned && coverage.complete && hairCoverageComplete && bootGeometryCount === 2 && rigidPrimitiveCount === 0);
  return Object.freeze({
    installed,
    appearanceMode: "player-v3-integrated-body-material",
    variantIndex: body?.userData?.tonyPlayerV3VariantIndex ?? null,
    variantName: body?.userData?.tonyPlayerV3VariantName ?? null,
    kitPattern: body?.userData?.tonyPlayerV3KitPattern ?? null,
    hairStyle: body?.userData?.tonyPlayerV3HairStyle ?? null,
    skinnedSurfaceCount: bodyOwned ? 1 : 0,
    integratedBodySurfaceCount: bodyOwned ? 1 : 0,
    bootSurfaceCount: bootGeometryCount,
    bootRegionCount,
    hairGeometryCount,
    hairCoverageComplete,
    measuredHeadBounds: metrics.measuredHeadBounds,
    rigidPrimitiveCount,
    surfaceMapPreservedCount,
    visibleKitNodeCount: installed ? 7 : 0,
    bootGeometryCount,
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
  const metrics = ensureRigKitWeights(body, THREE);
  const originalMaterial = body.material;
  const originalUserData = { ...(body.userData ?? {}) };
  const createdMaterials = materialsOf(body).map((material) => createIntegratedAppearanceMaterial(THREE, material, palette, variant, variantIndex));
  let hairMeshes = [];
  let bootMeshes = [];
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
      tonyAppearanceCoverage: metrics.coverage,
      tonyAppearanceMetrics: metrics,
      tonyPlayerV3VariantIndex: variantIndex,
      tonyPlayerV3VariantName: variant.name,
      tonyPlayerV3KitPattern: variant.kitPattern,
      tonyPlayerV3HairStyle: variant.hairStyle,
    };
    hairMeshes = createHair({ THREE, root, body, metrics, palette, variant, variantIndex, lowPowerDevice });
    bootMeshes = createBootMeshes({ THREE, body, metrics, palette });
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
      || evidence.bootGeometryCount !== 2
      || !evidence.hairCoverageComplete
      || evidence.rigidPrimitiveCount !== 0
    ) throw new Error("football appearance installed incomplete Player V3 material");
    return evidence;
  } catch (error) {
    marker?.removeFromParent?.();
    disposeOwnedMeshes([...hairMeshes, ...bootMeshes]);
    body.material = originalMaterial;
    body.userData = originalUserData;
    disposeMaterials(createdMaterials);
    throw error;
  }
}
