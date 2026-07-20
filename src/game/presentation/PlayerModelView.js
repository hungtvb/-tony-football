import * as THREE_NAMESPACE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const SKIN = Object.freeze([0xd89d78, 0xb97958, 0x8f5a3d, 0xe5b08b]);
const HAIR = Object.freeze([0x231914, 0x38241b, 0x111413, 0x5a351f]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, alpha) => from + (to - from) * alpha;

function assertImmutable(value, name) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) throw new TypeError(`${name} must be an immutable object`);
}
function smoothAngle(current, target, ease) { return current + Math.atan2(Math.sin(target - current), Math.cos(target - current)) * ease; }
function motionPulse(progress, start = 0, end = 1) { if (progress <= start || progress >= end) return 0; return Math.sin(((progress - start) / (end - start)) * Math.PI); }
function disposeMaterial(material) {
  if (!material) return;
  for (const key of ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "alphaMap"]) material[key]?.dispose?.();
  material.dispose?.();
}
function disposeOwned(root) {
  root?.traverse?.((node) => { if (!node.userData?.tonySharedGeometry) node.geometry?.dispose?.(); (Array.isArray(node.material) ? node.material : [node.material]).forEach(disposeMaterial); });
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
  const sprite = new THREE.Sprite(material); sprite.scale.set(5.2, 1.3, 1); sprite.position.y = 7; return sprite;
}
function limb(THREE, material, endMaterial, length, radius, lowPowerDevice) {
  const root = new THREE.Group(); const segments = lowPowerDevice ? 6 : 10;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .9, length * .52, segments), material); upper.position.y = -length * .26; upper.castShadow = true; root.add(upper);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(radius * .86, radius * .7, length * .48, segments), endMaterial ?? material); lower.position.y = -length * .76; lower.castShadow = true; root.add(lower); return root;
}
function createProceduralPlayer({ THREE, document, player, lowPowerDevice }) {
  const home = player.team === 0; const keeper = player.role === "GK"; const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const jersey = new THREE.MeshStandardMaterial({ color: keeper ? (home ? 0x8a62dd : 0xed6757) : (home ? 0xe1bb58 : 0x34b8c7), roughness: .58 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[(player.index + player.team) % SKIN.length], roughness: .72 });
  const shorts = new THREE.MeshStandardMaterial({ color: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35), roughness: .72 });
  const socks = new THREE.MeshStandardMaterial({ color: home ? 0xe9d58f : 0xb8eff3, roughness: .82 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.82, 1.08, 2.45, lowPowerDevice ? 8 : 12), jersey); torso.position.y = 3.48; torso.scale.z = .88; torso.castShadow = true; body.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(1.78, .78, 1.2), shorts); hips.position.y = 2.02; hips.castShadow = true; body.add(hips);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.72, lowPowerDevice ? 10 : 18, lowPowerDevice ? 8 : 14), skin); head.position.y = 5.35; head.scale.set(.93, 1.08, .96); head.castShadow = true; body.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.74, lowPowerDevice ? 8 : 14, 7, 0, Math.PI * 2, 0, Math.PI * .46), new THREE.MeshStandardMaterial({ color: HAIR[(player.index + player.team) % HAIR.length], roughness: .92 })); hair.position.y = 5.55; body.add(hair);
  const leftLeg = limb(THREE, skin, socks, 1.9, .27, lowPowerDevice); const rightLeg = limb(THREE, skin, socks, 1.9, .27, lowPowerDevice); leftLeg.position.set(-.48, 1.75, 0); rightLeg.position.set(.48, 1.75, 0); body.add(leftLeg, rightLeg);
  const leftArm = limb(THREE, jersey, skin, 1.58, .22, lowPowerDevice); const rightArm = limb(THREE, jersey, skin, 1.58, .22, lowPowerDevice); leftArm.position.set(-1, 4.42, 0); rightArm.position.set(1, 4.42, 0); leftArm.rotation.z = -.24; rightArm.rotation.z = .24; body.add(leftArm, rightArm);
  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.7, .09, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: .92, toneMapped: false })); marker.rotation.x = Math.PI / 2; marker.position.y = .08; root.add(marker);
  const label = canvasLabel({ THREE, document, text: `${player.number} · ${player.name}`, accent: home ? "#e1bb58" : "#47c9d4" }); root.add(label);
  return { root, body, torso, head, leftLeg, rightLeg, leftArm, rightArm, marker, label, rig: null };
}
function createIntegratedKitMaterial(THREE, source, player, ownedMaterials) {
  const home = player.team === 0; const keeper = player.role === "GK"; const material = source.clone(); ownedMaterials.push(material);
  material.map = null; material.color.set(keeper ? (home ? 0x7650d6 : 0xe65348) : (home ? 0xe1bb58 : 0x32b8c8)); material.roughness = .68; material.metalness = 0;
  material.customProgramCacheKey = () => `football-kit-ton81-${player.team}-${player.role}-${player.index % 4}`; material.needsUpdate = true; return material;
}
function switchRigAnimation(THREE, rig, state, immediate = false) {
  if (!rig || rig.state === state) return false; const next = rig.actions[state] || rig.actions.Idle_Loop; if (!next) return false;
  const looping = state.endsWith("_Loop") || state === "Dance_Loop"; const fade = immediate ? 0 : looping ? .32 : .16;
  next.reset(); next.enabled = true; next.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, looping ? Infinity : 1); next.clampWhenFinished = !looping; next.fadeIn(fade).play();
  if (rig.active && rig.active !== next) rig.active.fadeOut(fade); rig.active = next; rig.state = state; return true;
}
function disposeCandidateMaterials(materials) {
  for (const material of new Set(materials ?? [])) {
    try { disposeMaterial(material); } catch {}
  }
}
function releaseRigCandidate(rig) {
  try { rig?.mixer?.stopAllAction?.(); } catch {}
  disposeCandidateMaterials(rig?.ownedMaterials);
}
function prepareRigCandidate({ THREE, cloneModel, player, characterScene, animations }) {
  let model = null; let mixer = null; const ownedMaterials = [];
  try {
    model = cloneModel(characterScene); model.scale.set(2.96, 3.28, 2.96); model.rotation.y = 0;
    model.traverse((node) => {
      if (!node.isMesh) return; node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; node.userData.tonySharedGeometry = true;
      const source = Array.isArray(node.material) ? node.material : [node.material]; const mapped = source.map((material) => createIntegratedKitMaterial(THREE, material, player, ownedMaterials)); node.material = Array.isArray(node.material) ? mapped : mapped[0];
    });
    mixer = new THREE.AnimationMixer(model); const actions = {}; for (const clip of animations ?? []) actions[clip.name] = mixer.clipAction(clip);
    const rig = { model, mixer, actions, ownedMaterials, state: "", active: null, lastTime: null, yaw: Math.atan2(player.dirX ?? 1, player.dirY ?? 0), head: model.getObjectByName("Head"), spine: model.getObjectByName("spine_03"), pelvis: model.getObjectByName("pelvis"), rightThigh: model.getObjectByName("thigh_r"), rightCalf: model.getObjectByName("calf_r"), rightFoot: model.getObjectByName("foot_r") };
    switchRigAnimation(THREE, rig, "Idle_Loop", true);
    return rig;
  } catch (error) {
    try { mixer?.stopAllAction?.(); } catch {}
    disposeCandidateMaterials(ownedMaterials);
    throw error;
  }
}
function commitRig(view, rig) {
  const proceduralVisible = view.body.visible; let added = false;
  try {
    view.root.add(rig.model); added = true;
    view.body.visible = false; view.rig = rig;
    return true;
  } catch (error) {
    if (view.rig === rig) view.rig = null;
    view.body.visible = proceduralVisible;
    const candidateAttached = added || rig.model?.parent === view.root || view.root.children?.includes?.(rig.model);
    if (candidateAttached) {
      try { view.root.remove(rig.model); } catch {}
    }
    releaseRigCandidate(rig);
    throw error;
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
  const THREE = three; const view = createProceduralPlayer({ THREE, document, player, lowPowerDevice }); let attached = false; let disposed = false; let installError = "";
  function attach() { if (attached || disposed) return false; if (scenePort.addObject(view.root) === false) return false; attached = true; return true; }
  function installAsset({ characterScene, animations = [] } = {}) {
    if (disposed || !characterScene || view.rig) return false;
    try {
      const candidate = prepareRigCandidate({ THREE, cloneModel, player, characterScene, animations });
      commitRig(view, candidate); installError = ""; return true;
    } catch (error) {
      installError = error?.message ?? String(error); return false;
    }
  }
  function installAnimations(nextAnimations = []) {
    if (disposed || !view.rig || !Array.isArray(nextAnimations)) return false;
    const rig = view.rig; const previous = { actions: rig.actions, state: rig.state, active: rig.active };
    try {
      const actions = {}; for (const clip of nextAnimations) actions[clip.name] = rig.mixer.clipAction(clip, rig.model);
      rig.actions = actions; rig.state = ""; rig.active = null; switchRigAnimation(THREE, rig, "Idle_Loop", true); installError = ""; return true;
    } catch (error) {
      rig.actions = previous.actions; rig.state = previous.state; rig.active = previous.active;
      installError = error?.message ?? String(error); return false;
    }
  }
  function render({ player: pose, ball, selectedPlayerId, replayActive = false, controlMode = "attack", pressedCodes = Object.freeze([]), nowMilliseconds = 0 } = {}) {
    assertImmutable(pose, "player render facts"); assertImmutable(ball, "ball render facts"); if (disposed) return false;
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
    const selected = !replayActive && pose.id === selectedPlayerId; view.marker.visible = selected;
    if (selected) { view.marker.scale.setScalar(1 + Math.sin(nowMilliseconds * .006) * .08); view.marker.material.color.set(controlMode === "defense" && pressedCodes.length ? 0x47c9d4 : 0xffd86b); }
    view.label.visible = !replayActive && (selected || speed < 10); return true;
  }
  function reset() { if (disposed) return false; view.root.position.set(0, 0, 0); view.root.rotation.set(0, 0, 0); if (view.rig) { view.rig.lastTime = null; view.rig.state = ""; view.rig.active = null; switchRigAnimation(THREE, view.rig, "Idle_Loop", true); } return true; }
  function teardown() {
    if (disposed) return false;
    const errors = [];
    if (attached) {
      try { scenePort.removeObject(view.root); } catch (error) { errors.push(error); }
    }
    attached = false; disposed = true;
    try { view.rig?.mixer?.stopAllAction?.(); } catch (error) { errors.push(error); }
    try { disposeOwned(view.root); } catch (error) { errors.push(error); }
    view.rig = null;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, `player model view ${player.id} teardown reported errors`);
    return true;
  }
  return Object.freeze({ get id() { return player.id; }, get root() { return view.root; }, get attached() { return attached; }, get rigged() { return Boolean(view.rig); }, attach, installAsset, installAnimations, render, reset, teardown, diagnostics: () => Object.freeze({ id: player.id, attached, rigged: Boolean(view.rig), disposed, installError }) });
}
