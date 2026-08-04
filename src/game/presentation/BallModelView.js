import * as THREE_NAMESPACE from "three";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../config/simulationScaleProfile.js";
import {
  createBallMotionPresentationState,
  resetBallMotionPresentationState,
  stepBallMotionPresentation,
} from "./BallMotionPresentation.js";

const BALL_RADIUS = DEFAULT_SIMULATION_SCALE_PROFILE.ball.radiusWorldUnits;
const CHARGE_HEIGHT = DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits + .55;

const BALL_STYLES = Object.freeze({
  classic: Object.freeze({ base: 0xf3f4ef, patch: 0x17201d, stroke: "#59635e" }),
  volt: Object.freeze({ base: 0xdff44a, patch: 0x172019, stroke: "#5b681b" }),
  crimson: Object.freeze({ base: 0xf2f3f1, patch: 0xc92832, stroke: "#7c3439" }),
});

function assertImmutableRecord(value, name) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) throw new TypeError(`${name} must be an immutable object`);
}
function cssColor(value) { return `#${value.toString(16).padStart(6, "0")}`; }
function disposeMaterial(material) {
  if (!material) return; material.map?.dispose?.(); material.bumpMap?.dispose?.(); material.dispose?.();
}
function createBallSurfaceTextures({ THREE, document, style, anisotropy }) {
  const width = 768; const height = 384; const colorCanvas = document.createElement("canvas"); const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = bumpCanvas.width = width; colorCanvas.height = bumpCanvas.height = height;
  const paint = colorCanvas.getContext("2d"); const bump = bumpCanvas.getContext("2d");
  paint.fillStyle = cssColor(style.base); paint.fillRect(0, 0, width, height); bump.fillStyle = "#d8d8d8"; bump.fillRect(0, 0, width, height);
  const drawSeams = (target, color, lineWidth) => {
    target.strokeStyle = color; target.lineWidth = lineWidth; target.lineCap = "round"; target.lineJoin = "round";
    for (let index = 0; index < 6; index += 1) { const x = (index + .5) * width / 6; target.beginPath(); target.moveTo(x - 22, 0); target.bezierCurveTo(x + 42, height * .24, x - 40, height * .74, x + 20, height); target.stroke(); }
    for (let row = 1; row < 4; row += 1) { const y = row * height / 4; target.beginPath(); target.moveTo(0, y + 12); target.bezierCurveTo(width * .24, y - 26, width * .72, y + 24, width, y - 10); target.stroke(); }
  };
  drawSeams(paint, style.stroke, 3.4); drawSeams(bump, "#444", 7); paint.fillStyle = cssColor(style.patch);
  for (const [x, y, rotation] of [[92,76,-.18],[244,205,.22],[392,98,-.12],[548,270,.18],[685,146,-.2],[78,326,.14],[444,332,-.15]]) {
    paint.save(); paint.translate(x, y); paint.rotate(rotation); paint.beginPath(); paint.moveTo(-28, -8); paint.quadraticCurveTo(-2, -28, 30, -14); paint.lineTo(18, 13); paint.quadraticCurveTo(-4, 26, -31, 10); paint.closePath(); paint.fill(); paint.restore();
  }
  const map = new THREE.CanvasTexture(colorCanvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping; map.anisotropy = anisotropy;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas); bumpMap.wrapS = THREE.RepeatWrapping; bumpMap.anisotropy = anisotropy; return { map, bumpMap };
}

export function createBallModelView({ scenePort, document, worldX, worldZ, three = THREE_NAMESPACE } = {}) {
  if (!scenePort || typeof scenePort.addObject !== "function" || typeof scenePort.removeObject !== "function") throw new TypeError("BallModelView requires a scene port");
  if (!document || typeof document.createElement !== "function") throw new TypeError("BallModelView requires a document");
  if (typeof worldX !== "function" || typeof worldZ !== "function") throw new TypeError("BallModelView requires world projection functions");
  const THREE = three; const anisotropy = Math.max(1, Number(scenePort.diagnostics?.().maxAnisotropy ?? 1));
  const root = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .58, metalness: 0, clearcoat: .16, clearcoatRoughness: .7, bumpScale: .035 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 48, 32), material); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x07100d, transparent: true, opacity: .34, depthWrite: false, toneMapped: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_RADIUS * 1.3, 32), shadowMaterial); shadow.name = "TonyBallContactShadow"; shadow.rotation.x = -Math.PI / 2; shadow.position.y = BALL_RADIUS * .16; shadow.renderOrder = 1; root.add(shadow);
  const chargeRoot = new THREE.Group(); const background = new THREE.Mesh(new THREE.BoxGeometry(1.2, .06, .08), new THREE.MeshBasicMaterial({ color: 0x080b0a, transparent: true, opacity: .8 }));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(1.16, .065, .085), new THREE.MeshBasicMaterial({ color: 0xffcf58, toneMapped: false })); fill.position.y = .02; chargeRoot.add(background, fill); chargeRoot.visible = false;
  const motionState = createBallMotionPresentationState();
  let motionDiagnostics = Object.freeze({ speed: 0, height: 0, verticalSpeed: 0, impactPulse: 0, squash: 0, shadowOpacity: .34, shadowScale: 1 });
  let attached = false; let disposed = false; let activeStyle = null;
  function applyStyle(styleId = "classic") {
    if (disposed || styleId === activeStyle) return false;
    const style = BALL_STYLES[styleId] ?? BALL_STYLES.classic; const textures = createBallSurfaceTextures({ THREE, document, style, anisotropy });
    material.map?.dispose?.(); material.bumpMap?.dispose?.(); material.map = textures.map; material.bumpMap = textures.bumpMap; material.color.set(0xffffff); material.needsUpdate = true; activeStyle = BALL_STYLES[styleId] ? styleId : "classic"; return true;
  }
  function attach() {
    if (attached || disposed) return false; if (scenePort.addObject(root) === false) return false;
    if (scenePort.addObject(chargeRoot) === false) { scenePort.removeObject(root); return false; }
    attached = true; applyStyle("classic"); return true;
  }
  function render({ ball, selectedPlayer = null, selectedPlayerOwnsBall = false, activeCharge = null, ballStyle = "classic" } = {}) {
    assertImmutableRecord(ball, "ball render facts"); if (selectedPlayer !== null) assertImmutableRecord(selectedPlayer, "selected player render facts"); if (activeCharge !== null) assertImmutableRecord(activeCharge, "active charge facts"); if (disposed) return false;
    applyStyle(ballStyle);
    const motion = stepBallMotionPresentation({ state: motionState, ball });
    root.position.set(worldX(ball.x), 0, worldZ(ball.y));
    mesh.position.set(0, BALL_RADIUS + motion.height + motion.meshVerticalOffset, 0);
    mesh.scale.set(motion.meshScaleX, motion.meshScaleY, motion.meshScaleZ);
    mesh.rotation.set(motion.rollX, motion.rollY, motion.rollZ);
    shadow.scale.set(motion.shadowScale, motion.shadowScale, 1);
    shadow.material.opacity = motion.shadowOpacity;
    shadow.visible = motion.height < DEFAULT_SIMULATION_SCALE_PROFILE.goal.crossbarHeightWorldUnits * 3.6;
    motionDiagnostics = Object.freeze({
      speed: motion.speed,
      height: motion.height,
      verticalSpeed: motion.verticalSpeed,
      bounced: motion.bounced,
      impactPulse: motion.impactPulse,
      squash: motion.squash,
      shadowOpacity: motion.shadowOpacity,
      shadowScale: motion.shadowScale,
    });
    if (activeCharge && selectedPlayer && selectedPlayerOwnsBall) {
      chargeRoot.visible = true; chargeRoot.position.set(worldX(selectedPlayer.x), CHARGE_HEIGHT, worldZ(selectedPlayer.y)); scenePort.copyCameraQuaternion?.(chargeRoot.quaternion);
      const power = Math.max(0, Math.min(1, Number(activeCharge.power ?? 0))); fill.scale.x = Math.max(.02, power); fill.position.x = -.58 + .58 * power; fill.material.color.set(activeCharge.color ?? (power > .82 ? 0xff5b45 : 0xffcf58));
    } else chargeRoot.visible = false;
    return true;
  }
  function reset() {
    if (disposed) return false;
    root.position.set(0, 0, 0); mesh.position.set(0, BALL_RADIUS, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
    shadow.scale.set(1, 1, 1); shadow.material.opacity = .34; shadow.visible = true; chargeRoot.visible = false;
    resetBallMotionPresentationState(motionState); motionDiagnostics = Object.freeze({ speed: 0, height: 0, verticalSpeed: 0, impactPulse: 0, squash: 0, shadowOpacity: .34, shadowScale: 1 });
    return true;
  }
  function teardown() {
    if (disposed) return false; if (attached) { scenePort.removeObject(chargeRoot); scenePort.removeObject(root); }
    attached = false; disposed = true;
    root.traverse((node) => { node.geometry?.dispose?.(); (Array.isArray(node.material) ? node.material : [node.material]).forEach(disposeMaterial); });
    chargeRoot.traverse((node) => { node.geometry?.dispose?.(); (Array.isArray(node.material) ? node.material : [node.material]).forEach(disposeMaterial); }); return true;
  }
  return Object.freeze({
    attach,
    applyStyle,
    render,
    reset,
    teardown,
    diagnostics: () => Object.freeze({ owner: "ball-model-view", attached, disposed, style: activeStyle, chargeVisible: chargeRoot.visible, motion: motionDiagnostics }),
  });
}
