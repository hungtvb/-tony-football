import * as THREE_NAMESPACE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import {
  DEFAULT_SIMULATION_SCALE_PROFILE,
  representativeRigScale,
} from "../config/simulationScaleProfile.js";

const SKIN = Object.freeze([0xd89d78, 0xb97958, 0x8f5a3d, 0xe5b08b]);
const HAIR = Object.freeze([0x231914, 0x38241b, 0x111413, 0x5a351f]);
const SURFACES = Object.freeze(["kit", "shorts", "socks", "boots", "skin", "hair", "unknown"]);
const PLAYER_HEIGHT = DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits;
const PLAYER_RADIUS = DEFAULT_SIMULATION_SCALE_PROFILE.player.collisionRadiusMetres;
const PROCEDURAL_SOURCE_HEIGHT = 6.61;
const PROCEDURAL_SCALE = PLAYER_HEIGHT / PROCEDURAL_SOURCE_HEIGHT;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, alpha) => from + (to - from) * alpha;

function assertImmutable(value, name) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) throw new TypeError(`${name} must be an immutable object`);
}
function smoothAngle(current, target, ease) { return current + Math.atan2(Math.sin(target - current), Math.cos(target - current)) * ease; }
function motionPulse(progress, start = 0, end = 1) { if (progress <= start || progress >= end) return 0; return Math.sin(((progress - start) / (end - start)) * Math.PI); }
function disposeMaterial(material) {
  if (!material) return;
  if (!material.userData?.tonySharedTextures) {
    for (const key of ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "alphaMap"]) material[key]?.dispose?.();
  }
  material.dispose?.();
}
function disposeOwned(root) {
  root?.traverse?.((node) => { if (!node.userData?.tonySharedGeometry) node.geometry?.dispose?.(); (Array.isArray(node.material) ? node.material : [node.material]).forEach(disposeMaterial); });
}

function normalizedSurfaceLabel(nodeName = "", materialName = "") {
  return `${nodeName} ${materialName}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function classifyPlayerSurface(nodeName = "", materialName = "") {
  const label = normalizedSurfaceLabel(nodeName, materialName);
  if (/(^| )(boot|boots|shoe|shoes|cleat|cleats|sneaker|sneakers|footwear|foot l|foot r)( |$)/.test(label)) return "boots";
  if (/(^| )(sock|socks|stocking|stockings)( |$)/.test(label)) return "socks";
  if (/(^| )(short|shorts|trouser|trousers|pant|pants)( |$)/.test(label)) return "shorts";
  if (/(^| )(jersey|shirt|kit|uniform|top|torso|chest)( |$)/.test(label)) return "kit";
  if (/(^| )(hair|beard|brow|eyebrow|mustache|moustache)( |$)/.test(label)) return "hair";
  if (/(^| )(skin|face|head|hand|hands|arm|arms|leg|legs|neck|ear|ears)( |$)/.test(label)) return "skin";
  return "unknown";
}

function createAppearance(mode) {
  return {
    mode,
    materialCount: 0,
    preservedMapCount: 0,
    tintedKitMaterialCount: 0,
    sharedTextureMaterialCount: 0,
    footwearNodeCount: 0,
    semanticCounts: Object.fromEntries(SURFACES.map((surface) => [surface, 0])),
  };
}
function freezeAppearance(source) {
  const semanticCounts = Object.freeze({ ...source.semanticCounts });
  const bootCount = Math.max(Number(source.footwearNodeCount || 0), Number(semanticCounts.boots || 0));
  return Object.freeze({
    mode: source.mode,
    materialCount: source.materialCount,
    preservedMapCount: source.preservedMapCount,
    tintedKitMaterialCount: source.tintedKitMaterialCount,
    sharedTextureMaterialCount: source.sharedTextureMaterialCount,
    footwearNodeCount: source.footwearNodeCount,
    bootCount,
    semanticCounts,
  });
}
function kitColor(player, semantic) {
  const home = player.team === 0; const keeper = player.role === "GK";
  if (semantic === "kit") return keeper ? (home ? 0x7650d6 : 0xe65348) : (home ? 0xe1bb58 : 0x32b8c8);
  if (semantic === "shorts") return keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35);
  if (semantic === "socks") return home ? 0xe9d58f : 0xb8eff3;
  return null;
}

export function createSemanticPlayerMaterial({ source, nodeName = "", player, ownedMaterials, appearance } = {}) {
  if (!source || typeof source.clone !== "function") return source;
  const semantic = classifyPlayerSurface(nodeName, source.name ?? "");
  const material = source.clone(); ownedMaterials?.push?.(material);
  material.userData = {
    ...(material.userData ?? {}),
    tonyAppearanceSemantic: semantic,
    tonySourceMaterialName: source.name ?? "",
    tonySourceMapPreserved: Boolean(source.map && material.map === source.map),
    tonySharedTextures: true,
  };
  if (appearance) {
    appearance.materialCount += 1;
    appearance.semanticCounts[semantic] += 1;
    appearance.sharedTextureMaterialCount += 1;
    if (source.map && material.map === source.map) appearance.preservedMapCount += 1;
  }
  const color = kitColor(player, semantic);
  if (color !== null && material.color?.set) {
    material.color.set(color);
    const sourceCacheKey = typeof source.customProgramCacheKey === "function" ? source.customProgramCacheKey.bind(source) : () => "";
    material.customProgramCacheKey = () => `${sourceCacheKey()}|football-kit-ton93-${semantic}-${player.team}-${player.role}-${player.index % 4}`;
    material.needsUpdate = true;
    if (appearance) appearance.tintedKitMaterialCount += 1;
  }
  return material;
}

export function selectPlayerAnimationState(player, speed, currentState = "") {
  assertImmutable(player, "player render facts");
  if (player.anim === "celebrate") return "Dance_Loop";
  if (player.anim === "dive") return "Roll";
  if (player.anim === "tackle" || player.anim === "receive") return "Idle_Loop";
  if (currentState === "Sprint_Loop" && speed > 178) return currentState;
  if (speed > 218) return "Sprint_Loop";
  if (currentState === "Jog_Fwd_Loop" && speed > 18) return currentState;
  if (speed > 26) return "Jog_Fwd_Loop";
  return "Idle_Loop";
}

function canvasLabel({ THREE, document, text, accent }) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 64; const paint = canvas.getContext("2d");
  paint.fillStyle = "rgba(4,8,7,.86)"; paint.roundRect(4, 6, 248, 50, 12); paint.fill(); paint.strokeStyle = accent; paint.lineWidth = 3; paint.stroke();
  paint.fillStyle = "white"; paint.font = "700 27px Inter"; paint.textAlign = "center"; paint.textBaseline = "middle"; paint.fillText(text, 128, 32);
  const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(1.65, .42, 1); sprite.position.y = PLAYER_HEIGHT + .34; return sprite;
}
function limb(THREE, material, endMaterial, length, radius, lowPowerDevice) {
  const root = new THREE.Group(); const segments = lowPowerDevice ? 6 : 10;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .9, length * .52, segments), material); upper.position.y = -length * .26; upper.castShadow = true; root.add(upper);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(radius * .86, radius * .7, length * .48, segments), endMaterial ?? material); lower.position.y = -length * .76; lower.castShadow = true; root.add(lower); return root;
}
function boot(THREE, material, side, lowPowerDevice) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.48, .3, .82, lowPowerDevice ? 1 : 2, 1, lowPowerDevice ? 1 : 2), material);
  mesh.name = side === "left" ? "TonyBootLeft" : "TonyBootRight";
  mesh.userData.tonyAppearanceSemantic = "boots";
  mesh.position.set(0, -1.92, .22); mesh.rotation.x = -.08; mesh.castShadow = true; return mesh;
}
function createProceduralPlayer({ THREE, document, player, lowPowerDevice }) {
  const home = player.team === 0; const keeper = player.role === "GK"; const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const jersey = new THREE.MeshStandardMaterial({ color: keeper ? (home ? 0x8a62dd : 0xed6757) : (home ? 0xe1bb58 : 0x34b8c7), roughness: .58 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[(player.index + player.team) % SKIN.length], roughness: .72 });
  const shorts = new THREE.MeshStandardMaterial({ color: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35), roughness: .72 });
  const socks = new THREE.MeshStandardMaterial({ color: home ? 0xe9d58f : 0xb8eff3, roughness: .82 });
  const boots = new THREE.MeshStandardMaterial({ color: keeper ? 0x18191f : 0x111413, roughness: .6, metalness: .04 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.82, 1.08, 2.45, lowPowerDevice ? 8 : 12), jersey); torso.name = "TonyJersey"; torso.position.y = 3.48; torso.scale.z = .88; torso.castShadow = true; body.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(1.78, .78, 1.2), shorts); hips.name = "TonyShorts"; hips.position.y = 2.02; hips.castShadow = true; body.add(hips);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.72, lowPowerDevice ? 10 : 18, lowPowerDevice ? 8 : 14), skin); head.name = "TonySkinHead"; head.position.y = 5.35; head.scale.set(.93, 1.08, .96); head.castShadow = true; body.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.74, lowPowerDevice ? 8 : 14, 7, 0, Math.PI * 2, 0, Math.PI * .46), new THREE.MeshStandardMaterial({ color: HAIR[(player.index + player.team) % HAIR.length], roughness: .92 })); hair.name = "TonyHair"; hair.position.y = 5.55; body.add(hair);
  const leftLeg = limb(THREE, skin, socks, 1.9, .27, lowPowerDevice); const rightLeg = limb(THREE, skin, socks, 1.9, .27, lowPowerDevice); leftLeg.name = "TonySockLegLeft"; rightLeg.name = "TonySockLegRight"; leftLeg.position.set(-.48, 1.75, 0); rightLeg.position.set(.48, 1.75, 0);
  const leftBoot = boot(THREE, boots, "left", lowPowerDevice); const rightBoot = boot(THREE, boots, "right", lowPowerDevice); leftLeg.add(leftBoot); rightLeg.add(rightBoot); body.add(leftLeg, rightLeg);
  const leftArm = limb(THREE, jersey, skin, 1.58, .22, lowPowerDevice); const rightArm = limb(THREE, jersey, skin, 1.58, .22, lowPowerDevice); leftArm.position.set(-1, 4.42, 0); rightArm.position.set(1, 4.42, 0); leftArm.rotation.z = -.24; rightArm.rotation.z = .24; body.add(leftArm, rightArm);
  body.scale.setScalar(PROCEDURAL_SCALE); body.position.y = .09;
  const marker = new THREE.Mesh(new THREE.TorusGeometry(PLAYER_RADIUS * 1.22, .025, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: .92, toneMapped: false })); marker.rotation.x = Math.PI / 2; marker.position.y = .025; root.add(marker);
  const label = canvasLabel({ THREE, document, text: `${player.number} · ${player.name}`, accent: home ? "#e1bb58" : "#47c9d4" }); root.add(label);
  const appearance = freezeAppearance({ mode: "fallback", materialCount: 6, preservedMapCount: 0, tintedKitMaterialCount: 3, sharedTextureMaterialCount: 0, footwearNodeCount: 2, semanticCounts: { kit: 1, shorts: 1, socks: 2, boots: 2, skin: 3, hair: 1, unknown: 0 } });
  return { root, body, torso, head, leftLeg, rightLeg, leftArm, rightArm, leftBoot, rightBoot, marker, label, rig: null, appearance };
}
function switchRigAnimation(THREE, rig, state, immediate = false) {
  if (!rig || rig.state === state) return false; const next = rig.actions[state] || rig.actions.Idle_Loop; if (!next) return false;
  const looping = state.endsWith("_Loop") || state === "Dance_Loop"; const fade = immediate ? 0 : looping ? .32 : .16;
  next.reset(); next.enabled = true; next.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, looping ? Infinity : 1); next.clampWhenFinished = !looping; next.fadeIn(fade).play();
  if (rig.active && rig.active !== next) rig.active.fadeOut(fade); rig.active = next; rig.state = state; return true;
}
function disposeCandidateMaterials(materials) {
  for (const material of new Set(materials ?? [])) { try { disposeMaterial(material); } catch {} }
}
function releaseAnimationSet(animationSet, errors = null) {
  if (!animationSet?.mixer) return;
  const collected = errors ?? [];
  for (const action of new Set(Object.values(animationSet.actions ?? {}).filter(Boolean))) { try { action.stop?.(); } catch (error) { collected.push(error); } }
  try { animationSet.mixer.stopAllAction?.(); } catch (error) { collected.push(error); }
  try { animationSet.mixer.uncacheRoot?.(animationSet.model); } catch (error) { collected.push(error); }
  if (!errors && collected.length === 1) throw collected[0];
  if (!errors && collected.length > 1) throw new AggregateError(collected, "animation-set release reported errors");
}
function prepareAnimationSet({ THREE, model, animations = [] }) {
  const mixer = new THREE.AnimationMixer(model); const actions = {};
  try {
    for (const clip of animations) actions[clip.name] = mixer.clipAction(clip, model);
    const candidate = { model, mixer, actions, clips: Object.freeze([...animations]), state: "", active: null };
    switchRigAnimation(THREE, candidate, "Idle_Loop", true); return candidate;
  } catch (error) {
    try { releaseAnimationSet({ model, mixer, actions }); } catch {} throw error;
  }
}
function releaseRigCandidate(rig, errors = null) {
  try { releaseAnimationSet(rig, errors); } catch (error) { if (errors) errors.push(error); }
  disposeCandidateMaterials(rig?.ownedMaterials);
}
function countFootwearNodes(model) {
  let count = 0;
  model?.traverse?.((node) => { if (/(^|[^a-z])(boot|shoe|cleat|foot)([^a-z]|$)/i.test(node.name ?? "")) count += 1; });
  return count;
}
function measureAndNormalizeRig({ THREE, model, scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE }) {
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld?.(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const measuredHeight = Number(size.y);
  const scale = representativeRigScale(measuredHeight, scaleProfile);
  model.scale.setScalar(scale);
  model.updateMatrixWorld?.(true);
  model.userData.tonyScaleProfileId = scaleProfile.id;
  model.userData.tonyMeasuredRigHeight = measuredHeight;
  model.userData.tonyRepresentativeHeight = scaleProfile.player.representativeHeightWorldUnits;
  model.userData.tonyRigScale = scale;
  return Object.freeze({ measuredHeight, targetHeight: scaleProfile.player.representativeHeightWorldUnits, scale });
}
function prepareRigCandidate({ THREE, cloneModel, player, characterScene, animations }) {
  let model = null; let animationSet = null; const ownedMaterials = []; const appearance = createAppearance("asset");
  try {
    model = cloneModel(characterScene); measureAndNormalizeRig({ THREE, model }); model.rotation.y = 0;
    model.traverse((node) => {
      if (!node.isMesh) return; node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; node.userData.tonySharedGeometry = true;
      const source = Array.isArray(node.material) ? node.material : [node.material];
      const mapped = source.map((material) => createSemanticPlayerMaterial({ source: material, nodeName: node.name ?? "", player, ownedMaterials, appearance }));
      node.material = Array.isArray(node.material) ? mapped : mapped[0];
    });
    appearance.footwearNodeCount = countFootwearNodes(model);
    animationSet = prepareAnimationSet({ THREE, model, animations: animations ?? [] });
    return { model, ...animationSet, ownedMaterials, appearance: freezeAppearance(appearance), lastTime: null, yaw: Math.atan2(player.dirX ?? 1, player.dirY ?? 0), head: model.getObjectByName("Head"), spine: model.getObjectByName("spine_03"), pelvis: model.getObjectByName("pelvis"), rightThigh: model.getObjectByName("thigh_r"), rightCalf: model.getObjectByName("calf_r"), rightFoot: model.getObjectByName("foot_r") };
  } catch (error) {
    if (animationSet) { try { releaseAnimationSet(animationSet); } catch {} }
    disposeCandidateMaterials(ownedMaterials); throw error;
  }
}
function commitRig(view, rig) {
  const proceduralVisible = view.body.visible; const previousAppearance = view.appearance; let added = false;
  try { view.root.add(rig.model); added = true; view.body.visible = false; view.rig = rig; view.appearance = rig.appearance; return true; }
  catch (error) {
    if (view.rig === rig) view.rig = null; view.appearance = previousAppearance; view.body.visible = proceduralVisible;
    const candidateAttached = added || rig.model?.parent === view.root || view.root.children?.includes?.(rig.model);
    if (candidateAttached) { try { view.root.remove(rig.model); } catch {} }
    releaseRigCandidate(rig); throw error;
  }
}
function applyFootballActionPose(rig, player, progress, dt) {
  if (!rig.active) return; const shoot = motionPulse(progress, .24, 1); const pass = motionPulse(progress, .2, 1); const tackle = player.anim === "tackle" ? motionPulse(progress, 0, 1) : 0;
  if (player.anim === "shoot" && rig.rightThigh) rig.rightThigh.rotation.x -= shoot * 1.36; if (player.anim === "shoot" && rig.rightCalf) rig.rightCalf.rotation.x += shoot * .48;
  if (player.anim === "pass" && rig.rightThigh) rig.rightThigh.rotation.x -= pass * .72; if (player.anim === "pass" && rig.rightFoot) rig.rightFoot.rotation.y += pass * .32;
  const roll = -(player.turnLean || 0) * .14 + (player.animPower < 0 ? -1 : 1) * tackle * .72; rig.model.rotation.z = lerp(rig.model.rotation.z, roll, 1 - Math.exp(-dt * 18)); rig.model.position.y = lerp(rig.model.position.y, -tackle * .32, 1 - Math.exp(-dt * 20));
}

export function createPlayerModelView({ player, scenePort, document, worldX, worldZ, lowPowerDevice = false, three = THREE_NAMESPACE, cloneModel = cloneSkeleton } = {}) {
  assertImmutable(player, "player descriptor");
  if (!scenePort || typeof scenePort.addObject !== "function" || typeof scenePort.removeObject !== "function") throw new TypeError("PlayerModelView requires a scene port");
  if (!document || typeof document.createElement !== "function") throw new TypeError("PlayerModelView requires a document");
  if (typeof worldX !== "function" || typeof worldZ !== "function") throw new TypeError("PlayerModelView requires world projection functions");
  const THREE = three; const view = createProceduralPlayer({ THREE, document, player, lowPowerDevice });
  let attached = false; let disposed = false; let terminating = false; let rootDisposed = false; let currentAnimationReleased = false; let installError = ""; const retiredAnimationSets = [];
  let motionDiagnostics = Object.freeze({ speed: 0, sprinting: false, animationState: "Idle_Loop", animationTimeScale: 1, snapshotX: player.x, snapshotY: player.y, worldX: worldX(player.x), worldZ: worldZ(player.y) });
  function unavailable() { return disposed || terminating; }
  function attach() { if (attached || unavailable()) return false; if (scenePort.addObject(view.root) === false) return false; attached = true; return true; }
  function retryRetiredAnimationSets(errors = null) {
    for (let index = retiredAnimationSets.length - 1; index >= 0; index -= 1) {
      try { releaseAnimationSet(retiredAnimationSets[index]); retiredAnimationSets.splice(index, 1); }
      catch (error) { errors?.push(error); }
    }
  }
  function installAsset({ characterScene, animations = [] } = {}) {
    if (unavailable() || !characterScene || view.rig) return false;
    try { const candidate = prepareRigCandidate({ THREE, cloneModel, player, characterScene, animations }); commitRig(view, candidate); currentAnimationReleased = false; installError = ""; return true; }
    catch (error) { installError = error?.message ?? String(error); return false; }
  }
  function installAnimations(nextAnimations = []) {
    if (unavailable() || !view.rig || !Array.isArray(nextAnimations)) return false;
    const rig = view.rig; let candidate = null;
    try { candidate = prepareAnimationSet({ THREE, model: rig.model, animations: nextAnimations }); }
    catch (error) { installError = error?.message ?? String(error); return false; }
    const previous = { model: rig.model, mixer: rig.mixer, actions: rig.actions, clips: rig.clips, state: rig.state, active: rig.active };
    rig.mixer = candidate.mixer; rig.actions = candidate.actions; rig.clips = candidate.clips; rig.state = candidate.state; rig.active = candidate.active; rig.lastTime = null; currentAnimationReleased = false; retiredAnimationSets.push(previous);
    try { releaseAnimationSet(previous); retiredAnimationSets.pop(); installError = ""; }
    catch (error) { installError = `animation refresh committed; previous cleanup deferred: ${error?.message ?? String(error)}`; }
    return true;
  }
  function render({ player: pose, ball, selectedPlayerId, replayActive = false, controlMode = "attack", pressedCodes = Object.freeze([]), nowMilliseconds = 0 } = {}) {
    assertImmutable(pose, "player render facts"); assertImmutable(ball, "ball render facts"); if (unavailable()) return false;
    const speed = Math.hypot(pose.vx || 0, pose.vy || 0); const running = speed > 30; const stride = running ? Math.sin(pose.stepPhase || 0) * clamp(speed / 185, .35, 1.25) : 0;
    view.root.position.set(worldX(pose.x), 0, worldZ(pose.y));
    if (view.rig) {
      const rig = view.rig; const dt = Math.min(.05, Math.max(0, (nowMilliseconds - (rig.lastTime ?? nowMilliseconds)) / 1000)); rig.lastTime = nowMilliseconds;
      const ballYaw = Math.atan2(ball.x - pose.x, ball.y - pose.y); const moveYaw = pose.motionYaw ?? Math.atan2(pose.vx || pose.dirX || 0, pose.vy || pose.dirY || 1); rig.yaw = smoothAngle(rig.yaw, running ? moveYaw : ballYaw, 1 - Math.exp(-dt * (pose.sprinting ? 8 : 11))); view.root.rotation.y = rig.yaw;
      switchRigAnimation(THREE, rig, selectPlayerAnimationState(pose, speed, rig.state)); if (rig.active) rig.active.timeScale = rig.state === "Sprint_Loop" ? clamp(speed / 225, .82, 1.42) : rig.state === "Jog_Fwd_Loop" ? clamp(speed / 160, .78, 1.34) : 1; rig.mixer.update(dt);
      applyFootballActionPose(rig, pose, pose.animDuration ? clamp(1 - pose.animTime / pose.animDuration, 0, 1) : 1, dt);
      if (rig.head) rig.head.rotation.y += clamp(Math.atan2(Math.sin(ballYaw - rig.yaw), Math.cos(ballYaw - rig.yaw)), -.68, .68) * .62;
    } else {
      view.root.rotation.y = pose.motionYaw ?? Math.atan2(pose.dirX || 0, pose.dirY || 1); const progress = pose.animDuration ? 1 - pose.animTime / pose.animDuration : 1; const wave = pose.animTime > 0 ? Math.sin(clamp(progress, 0, 1) * Math.PI) : 0; const kick = pose.anim === "shoot" || pose.anim === "pass" ? wave : 0; const tackle = pose.anim === "tackle" ? wave : 0;
      view.body.position.y = running ? Math.abs(Math.sin(pose.stepPhase || 0)) * .12 : 0; view.body.rotation.z = stride * .025 - (pose.turnLean || 0) * .16; view.body.rotation.x = tackle * .6 - kick * .08; view.leftLeg.rotation.x = stride * .72 - tackle * 1.05; view.rightLeg.rotation.x = -stride * .72 - kick * (pose.anim === "shoot" ? 1.45 : 1.05); view.leftArm.rotation.x = -stride * .62 - kick * .45; view.rightArm.rotation.x = stride * .62 + kick * .72;
    }
    motionDiagnostics = Object.freeze({
      speed,
      sprinting: Boolean(pose.sprinting),
      animationState: view.rig?.state ?? (running ? "procedural-run" : "procedural-idle"),
      animationTimeScale: Number(view.rig?.active?.timeScale ?? 1),
      snapshotX: pose.x,
      snapshotY: pose.y,
      worldX: view.root.position.x,
      worldZ: view.root.position.z,
    });
    const selected = !replayActive && pose.id === selectedPlayerId; view.marker.visible = selected;
    if (selected) { view.marker.scale.setScalar(1 + Math.sin(nowMilliseconds * .006) * .08); view.marker.material.color.set(controlMode === "defense" && pressedCodes.length ? 0x47c9d4 : 0xffd86b); }
    view.label.visible = !replayActive && (selected || speed < 10); return true;
  }
  function reset() {
    if (unavailable()) return false; view.root.position.set(0, 0, 0); view.root.rotation.set(0, 0, 0); retryRetiredAnimationSets();
    if (view.rig) {
      view.rig.lastTime = null;
      try { view.rig.mixer.stopAllAction?.(); view.rig.state = ""; view.rig.active = null; switchRigAnimation(THREE, view.rig, "Idle_Loop", true); }
      catch (error) { installError = error?.message ?? String(error); return false; }
    }
    return true;
  }
  function teardown() {
    if (disposed) return false; const errors = []; terminating = true;
    if (attached) { try { scenePort.removeObject(view.root); attached = false; } catch (error) { errors.push(error); } }
    if (view.rig && !currentAnimationReleased) { try { releaseAnimationSet(view.rig); currentAnimationReleased = true; } catch (error) { errors.push(error); } }
    retryRetiredAnimationSets(errors);
    const animationOwnershipReleased = (!view.rig || currentAnimationReleased) && retiredAnimationSets.length === 0;
    if (!attached && animationOwnershipReleased && !rootDisposed) { try { disposeOwned(view.root); rootDisposed = true; } catch (error) { errors.push(error); } }
    if (!attached && animationOwnershipReleased && rootDisposed) { view.rig = null; disposed = true; terminating = false; installError = ""; }
    if (errors.length === 1) throw errors[0]; if (errors.length > 1) throw new AggregateError(errors, `player model view ${player.id} teardown reported errors`); return disposed;
  }
  return Object.freeze({
    get id() { return player.id; }, get root() { return view.root; }, get attached() { return attached; }, get rigged() { return Boolean(view.rig); },
    attach, installAsset, installAnimations, render, reset, teardown,
    diagnostics: () => Object.freeze({
      id: player.id, team: player.team, role: player.role, attached, rigged: Boolean(view.rig), disposed, terminating, installError,
      retiredAnimationSetCount: retiredAnimationSets.length, currentAnimationReleased, rootDisposed, appearance: view.appearance, motion: motionDiagnostics,
    }),
  });
}
