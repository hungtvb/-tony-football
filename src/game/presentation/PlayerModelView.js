const HOME = 0;
const SKIN = Object.freeze([0xd89d78, 0xb97958, 0x8f5a3d, 0xe5b08b]);
const HAIR = Object.freeze([0x231914, 0x38241b, 0x111413, 0x5a351f]);

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const lerp = (from, to, alpha) => from + (to - from) * alpha;
const smoothAngle = (current, target, ease) => current + Math.atan2(Math.sin(target - current), Math.cos(target - current)) * ease;
const pulse = (progress, start = 0, end = 1) => progress <= start || progress >= end ? 0 : Math.sin(((progress - start) / (end - start)) * Math.PI);

function assertFrozen(value, name) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) throw new TypeError(`${name} must be immutable`);
}

function dispose(root, { sharedGeometry = false, sharedTextures = false } = {}) {
  root?.traverse?.((node) => {
    if (!sharedGeometry || node.userData?.tonyOwnedGeometry) node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (!sharedTextures) {
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"]) material[key]?.dispose?.();
      }
      material.dispose?.();
    }
  });
}

function owned(mesh) {
  mesh.userData = { ...(mesh.userData ?? {}), tonyOwnedGeometry: true };
  return mesh;
}

function canvasTexture({ THREE, document, width, height, paint }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function labelSprite({ THREE, document, player }) {
  const home = player.team === HOME;
  const texture = canvasTexture({
    THREE, document, width: 256, height: 64,
    paint: (ctx) => {
      ctx.fillStyle = "rgba(4,8,7,.86)";
      ctx.roundRect(4, 6, 248, 50, 12);
      ctx.fill();
      ctx.strokeStyle = home ? "#e1bb58" : "#47c9d4";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = "700 27px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${player.number} · ${player.name}`, 128, 32);
    },
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false }));
  sprite.scale.set(5.2, 1.3, 1);
  sprite.position.y = 7;
  return sprite;
}

function numberPlanes({ THREE, document, player, color, rig = false, anisotropy = 1 }) {
  const texture = canvasTexture({
    THREE, document, width: 128, height: 128,
    paint: (ctx) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 8;
      ctx.font = "800 90px Barlow Condensed";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText(player.number, 64, 68);
      ctx.fillText(player.number, 64, 68);
    },
  });
  texture.anisotropy = anisotropy;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const front = owned(new THREE.Mesh(new THREE.PlaneGeometry(rig ? 0.205 : 0.72, rig ? 0.25 : 0.88), material));
  const back = owned(new THREE.Mesh(new THREE.PlaneGeometry(rig ? 0.245 : 0.92, rig ? 0.29 : 1.06), material.clone()));
  if (rig) {
    front.position.set(0, 0.035, 0.157);
    back.position.set(0, 0.035, -0.157);
  } else {
    front.position.set(0, 3.48, 1.005);
    back.position.set(0, 3.5, -1.005);
  }
  back.rotation.y = Math.PI;
  front.renderOrder = back.renderOrder = 3;
  return [front, back];
}

function limb({ THREE, material, endMaterial, bootMaterial, length, radius, lowPowerDevice, leg = false }) {
  const group = new THREE.Group();
  const segments = lowPowerDevice ? 6 : 10;
  const upperLength = length * 0.52;
  const lowerLength = length - upperLength;
  const upper = owned(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, upperLength, segments), material));
  upper.position.y = -upperLength / 2;
  const joint = owned(new THREE.Mesh(new THREE.SphereGeometry(radius * 0.92, segments, 6), endMaterial ?? material));
  joint.position.y = -upperLength;
  const lower = owned(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius * 0.7, lowerLength, segments), endMaterial ?? material));
  lower.position.y = -upperLength - lowerLength / 2;
  group.add(upper, joint, lower);
  if (leg) {
    const boot = owned(new THREE.Mesh(new THREE.BoxGeometry(radius * 1.6, 0.34, 0.86), bootMaterial));
    boot.position.set(0, -length - 0.12, 0.23);
    group.add(boot);
  }
  return group;
}

function proceduralView({ THREE, document, player, lowPowerDevice }) {
  const home = player.team === HOME;
  const keeper = player.role === "GK";
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const jersey = new THREE.MeshStandardMaterial({ color: keeper ? (home ? 0x8a62dd : 0xed6757) : (home ? 0xe1bb58 : 0x34b8c7), roughness: 0.56 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[(player.index + player.team) % SKIN.length], roughness: 0.7 });
  const shorts = new THREE.MeshStandardMaterial({ color: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35), roughness: 0.72 });
  const socks = new THREE.MeshStandardMaterial({ color: home ? 0xe9d58f : 0xb8eff3, roughness: 0.82 });
  const boots = new THREE.MeshStandardMaterial({ color: player.index % 3 === 0 ? 0xf25b48 : player.index % 3 === 1 ? 0xe8e9e6 : 0x171a1a, roughness: 0.38 });
  const torso = owned(new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.08, 2.45, lowPowerDevice ? 8 : 12), jersey));
  torso.position.y = 3.48;
  torso.scale.z = 0.88;
  const head = owned(new THREE.Mesh(new THREE.SphereGeometry(0.72, lowPowerDevice ? 10 : 18, lowPowerDevice ? 8 : 14), skin));
  head.position.y = 5.35;
  head.scale.set(0.93, 1.08, 0.96);
  const shortsMesh = owned(new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.78, 1.2), shorts));
  shortsMesh.position.y = 2.02;
  const leftLeg = limb({ THREE, material: skin, endMaterial: socks, bootMaterial: boots, length: 1.9, radius: 0.27, lowPowerDevice, leg: true });
  const rightLeg = limb({ THREE, material: skin, endMaterial: socks, bootMaterial: boots, length: 1.9, radius: 0.27, lowPowerDevice, leg: true });
  leftLeg.position.set(-0.48, 1.75, 0);
  rightLeg.position.set(0.48, 1.75, 0);
  const leftArm = limb({ THREE, material: jersey, endMaterial: skin, length: 1.58, radius: 0.22, lowPowerDevice });
  const rightArm = limb({ THREE, material: jersey, endMaterial: skin, length: 1.58, radius: 0.22, lowPowerDevice });
  leftArm.position.set(-1, 4.42, 0);
  rightArm.position.set(1, 4.42, 0);
  leftArm.rotation.z = -0.24;
  rightArm.rotation.z = 0.24;
  body.add(torso, head, shortsMesh, leftLeg, rightLeg, leftArm, rightArm);
  body.add(...numberPlanes({ THREE, document, player, color: home ? "#101413" : "#f0fbfa" }));
  const hair = owned(new THREE.Mesh(new THREE.SphereGeometry(0.74, lowPowerDevice ? 8 : 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.45), new THREE.MeshStandardMaterial({ color: HAIR[(player.index + player.team) % HAIR.length], roughness: 0.92 })));
  hair.position.y = 5.55;
  body.add(hair);
  const marker = owned(new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: 0.92, toneMapped: false })));
  marker.rotation.x = Math.PI / 2;
  marker.position.y = 0.08;
  const label = labelSprite({ THREE, document, player });
  root.add(marker, label);
  return { root, body, torso, head, leftLeg, rightLeg, leftArm, rightArm, marker, label };
}

function shaderColor(THREE, value) {
  const color = new THREE.Color(value);
  return `vec3(${color.r.toFixed(5)},${color.g.toFixed(5)},${color.b.toFixed(5)})`;
}

function kitMaterial({ THREE, source, player, palette, skinColor }) {
  const material = source.clone();
  material.map = material.aoMap = material.metalnessMap = material.roughnessMap = null;
  material.color.set(0xffffff);
  material.roughness = 0.68;
  material.metalness = 0;
  const color = {
    skin: shaderColor(THREE, skinColor),
    hair: shaderColor(THREE, HAIR[(player.index + player.team) % HAIR.length]),
    jersey: shaderColor(THREE, palette.jersey),
    light: shaderColor(THREE, palette.light),
    shorts: shaderColor(THREE, palette.shorts),
    socks: shaderColor(THREE, palette.socks),
    trim: shaderColor(THREE, palette.trim),
    boots: shaderColor(THREE, player.index % 3 === 0 ? 0xe64f3f : player.index % 3 === 1 ? 0xe7e9e7 : 0x141716),
  };
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vKitPosition;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvKitPosition=position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vKitPosition;").replace("#include <map_fragment>", `#include <map_fragment>
float y=vKitPosition.y;float x=abs(vKitPosition.x);vec3 c=${color.skin};
if(y<-.85)c=${color.boots};else if(y<-.54)c=${color.socks};
if(y>-.06&&y<.20&&x<.27)c=${color.shorts};
bool torso=y>.15&&y<.69&&x<.245;bool sleeve=y>.48&&y<.70&&x>=.18&&x<.50;
if(torso||sleeve)c=${color.jersey};if(torso&&y>.42&&y<.47)c=${color.trim};
if(sleeve&&x>.445)c=${color.trim};if(torso&&y>.63&&x<.16)c=${color.light};
if(y>.895+.014*sin(vKitPosition.x*38.0)+.010*cos(vKitPosition.z*34.0))c=${color.hair};
diffuseColor.rgb=c;`);
  };
  material.customProgramCacheKey = () => `football-kit-v3-${player.team}-${player.role}-${player.index % 4}`;
  material.needsUpdate = true;
  return material;
}

function prepareRig({ THREE, document, model, player, anisotropy }) {
  const home = player.team === HOME;
  const keeper = player.role === "GK";
  const palette = keeper
    ? { jersey: home ? 0x7650d6 : 0xe65348, light: home ? 0xbca4ff : 0xffa096, shorts: 0x20212c, socks: home ? 0xbca4ff : 0xffa096, trim: 0xf5f7f6 }
    : home
      ? { jersey: 0xe1bb58, light: 0xffe9ae, shorts: 0x171b1a, socks: 0xe8d486, trim: 0x161b19 }
      : { jersey: 0x32b8c8, light: 0xc4fbff, shorts: 0x082e35, socks: 0xb7edf2, trim: 0xf0fbfa };
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = node.receiveShadow = true;
    node.frustumCulled = false;
    node.userData = { ...(node.userData ?? {}), tonyOwnedGeometry: false };
    const source = Array.isArray(node.material) ? node.material : [node.material];
    const mapped = source.map((material) => node.name === "SuperHero_Male"
      ? kitMaterial({ THREE, source: material, player, palette, skinColor: SKIN[(player.index + player.team) % SKIN.length] })
      : material.clone());
    node.material = Array.isArray(node.material) ? mapped : mapped[0];
  });
  model.getObjectByName("spine_02")?.add(...numberPlanes({ THREE, document, player, color: home && !keeper ? "#101413" : "#f0fbfa", rig: true, anisotropy }));
  const names = { head: "Head", spine: "spine_03", pelvis: "pelvis", leftThigh: "thigh_l", rightThigh: "thigh_r", leftCalf: "calf_l", rightCalf: "calf_r", leftFoot: "foot_l", rightFoot: "foot_r", leftArm: "upperarm_l", rightArm: "upperarm_r" };
  return Object.fromEntries(Object.entries(names).map(([key, name]) => [key, model.getObjectByName(name)]));
}

export function selectPlayerRigAnimation(pose, speed, current = "") {
  if (pose.anim === "celebrate") return "Dance_Loop";
  if (pose.anim === "dive") return "Roll";
  if (pose.anim === "tackle" || pose.anim === "receive") return "Idle_Loop";
  if (current === "Sprint_Loop" && speed > 178) return current;
  if (speed > 218) return "Sprint_Loop";
  if (current === "Jog_Fwd_Loop" && speed > 18) return current;
  if (speed > 26) return "Jog_Fwd_Loop";
  return "Idle_Loop";
}

function switchAnimation(THREE, rig, state, immediate = false) {
  if (!rig || rig.state === state) return false;
  const next = rig.actions[state] || rig.actions.Idle_Loop;
  if (!next) return false;
  const looping = state.endsWith("_Loop") || state === "Dance_Loop";
  const fade = immediate ? 0 : looping ? 0.32 : 0.16;
  next.reset().setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, looping ? Infinity : 1);
  next.clampWhenFinished = !looping;
  next.fadeIn(fade).play();
  rig.active?.fadeOut?.(fade);
  rig.active = next;
  rig.state = state;
  return true;
}

function actionPose(rig, pose, progress, dt) {
  if (!rig.active) return;
  const strike = pulse(progress, 0.24, 1);
  const contact = pulse(progress, 0.2, 1);
  const slide = pulse(progress, 0, 1);
  if (pose.anim === "shoot" && rig.rightThigh) rig.rightThigh.rotation.x -= strike * 1.36;
  if (pose.anim === "pass" && rig.rightThigh) rig.rightThigh.rotation.x -= contact * 0.72;
  if (pose.anim === "receive" && rig.rightCalf) rig.rightCalf.rotation.x += contact * 0.48;
  if (pose.anim === "tackle") {
    if (rig.rightThigh) rig.rightThigh.rotation.x -= slide * 1.2;
    rig.model.rotation.z = lerp(rig.model.rotation.z, (pose.animPower < 0 ? -1 : 1) * slide * 0.72, 1 - Math.exp(-dt * 18));
  } else rig.model.rotation.z = lerp(rig.model.rotation.z, -(pose.turnLean || 0) * 0.14, 1 - Math.exp(-dt * 18));
}

export function createPlayerModelView({ THREE, document, scenePort, player, cloneSkeleton, lowPowerDevice = false, worldX = (value) => (value - 600) * 0.1, worldZ = (value) => (value - 350) * 0.1, clock = () => performance.now() } = {}) {
  if (!THREE || !document || !scenePort || typeof cloneSkeleton !== "function") throw new TypeError("PlayerModelView requires THREE, document, scene port and cloneSkeleton");
  assertFrozen(player, "player descriptor");
  const descriptor = Object.freeze({ ...player });
  const view = { ...proceduralView({ THREE, document, player: descriptor, lowPowerDevice }), player: descriptor, rig: null };
  scenePort.addObject(view.root);
  let disposed = false;
  let lastAnimation = null;

  function installAnimations(animations = []) {
    if (!view.rig || !Array.isArray(animations)) return false;
    view.rig.actions = Object.fromEntries(animations.filter((clip) => clip?.name).map((clip) => [clip.name, view.rig.mixer.clipAction(clip, view.rig.model)]));
    view.rig.state = "";
    view.rig.active = null;
    switchAnimation(THREE, view.rig, "Idle_Loop", true);
    return true;
  }

  function installCharacter({ scene, animations = [] } = {}) {
    if (disposed || !scene || view.rig) return false;
    try {
      const model = cloneSkeleton(scene);
      model.scale.set(2.96, 3.28, 2.96);
      const bones = prepareRig({ THREE, document, model, player: descriptor, anisotropy: scenePort.diagnostics?.().maxAnisotropy || 1 });
      view.body.visible = false;
      view.root.add(model);
      view.rig = { model, mixer: new THREE.AnimationMixer(model), actions: {}, state: "", active: null, lastTime: clock(), yaw: Math.atan2(descriptor.dirX ?? 1, descriptor.dirY ?? 0), ...bones };
      installAnimations(animations);
      return true;
    } catch {
      view.body.visible = true;
      view.rig = null;
      return false;
    }
  }

  function render(pose, facts) {
    if (disposed) return false;
    assertFrozen(pose, "player pose");
    assertFrozen(facts, "player render facts");
    const now = Number.isFinite(facts.nowMilliseconds) ? facts.nowMilliseconds : clock();
    const speed = Math.hypot(pose.vx, pose.vy);
    view.root.position.set(worldX(pose.x), 0, worldZ(pose.y));
    if (view.rig) {
      const dt = Math.min(0.05, Math.max(0, (now - view.rig.lastTime) / 1000));
      view.rig.lastTime = now;
      const targetYaw = pose.motionYaw ?? Math.atan2(pose.vx || pose.dirX, pose.vy || pose.dirY);
      view.rig.yaw = smoothAngle(view.rig.yaw, targetYaw, 1 - Math.exp(-dt * (pose.sprinting ? 8 : 11)));
      view.root.rotation.y = view.rig.yaw;
      const state = selectPlayerRigAnimation(pose, speed, view.rig.state);
      switchAnimation(THREE, view.rig, state);
      if (view.rig.active) view.rig.active.timeScale = state === "Sprint_Loop" ? clamp(speed / 225, 0.82, 1.42) : state === "Jog_Fwd_Loop" ? clamp(speed / 160, 0.78, 1.34) : 1;
      view.rig.mixer.update(dt);
      actionPose(view.rig, pose, pose.animDuration ? clamp(1 - pose.animTime / pose.animDuration, 0, 1) : 1, dt);
    } else {
      view.root.rotation.y = pose.motionYaw ?? Math.atan2(pose.dirX, pose.dirY);
      const stride = speed > 30 ? Math.sin(pose.stepPhase) * clamp(speed / 185, 0.35, 1.25) : 0;
      const action = pose.animTime > 0 ? Math.sin(clamp(1 - pose.animTime / (pose.animDuration || 1), 0, 1) * Math.PI) : 0;
      view.body.position.y = speed > 30 ? Math.abs(Math.sin(pose.stepPhase)) * 0.12 : 0;
      view.body.rotation.z = (pose.anim === "dive" ? action * pose.animPower * 0.9 : 0) - (pose.turnLean || 0) * 0.16;
      view.leftLeg.rotation.x = stride * 0.72 - (pose.anim === "tackle" ? action * 1.05 : 0);
      view.rightLeg.rotation.x = -stride * 0.72 - ((pose.anim === "shoot" || pose.anim === "pass") ? action * 1.25 : 0);
      view.leftArm.rotation.x = -stride * 0.62;
      view.rightArm.rotation.x = stride * 0.62;
    }
    view.marker.visible = !facts.replayActive && facts.selected;
    view.label.visible = !facts.replayActive && (facts.selected || speed < 10);
    if (view.marker.visible) {
      view.marker.scale.setScalar(1 + Math.sin(now * 0.006) * 0.08);
      const pressed = new Set(facts.pressedCodes);
      view.marker.material.color.set(facts.controlMode === "defense" && (pressed.has("KeyD") || pressed.has("KeyC")) ? 0x47c9d4 : 0xffd86b);
    }
    lastAnimation = pose.anim;
    return true;
  }

  function reset() {
    if (disposed) return false;
    view.root.position.set(0, 0, 0);
    view.root.rotation.set(0, 0, 0);
    view.marker.visible = view.label.visible = false;
    if (view.rig) {
      view.rig.mixer.stopAllAction();
      view.rig.mixer.setTime(0);
      view.rig.state = "";
      view.rig.active = null;
      view.rig.lastTime = clock();
      switchAnimation(THREE, view.rig, "Idle_Loop", true);
    }
    lastAnimation = null;
    return true;
  }

  function teardown() {
    if (disposed) return false;
    disposed = true;
    scenePort.removeObject(view.root);
    if (view.rig) {
      view.rig.mixer.stopAllAction();
      dispose(view.rig.model, { sharedGeometry: true, sharedTextures: true });
      view.root.remove(view.rig.model);
    }
    dispose(view.root);
    view.rig = null;
    return true;
  }

  const diagnostics = () => Object.freeze({ playerId: descriptor.id, owner: "player-model-view", rigged: Boolean(view.rig), disposed, lastAnimation });
  return Object.freeze({ installCharacter, installAnimations, render, reset, teardown, diagnostics });
}
