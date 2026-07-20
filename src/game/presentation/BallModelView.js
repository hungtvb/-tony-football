export const BALL_MODEL_STYLES = Object.freeze({
  classic: Object.freeze({ base: 0xf3f4ef, patch: 0x17201d, stroke: "#59635e" }),
  volt: Object.freeze({ base: 0xdff44a, patch: 0x172019, stroke: "#5b681b" }),
  crimson: Object.freeze({ base: 0xf2f3f1, patch: 0xc92832, stroke: "#7c3439" }),
});

function assertFrozenRecord(value, name) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) {
    throw new TypeError(`${name} must be an immutable object`);
  }
}

function cssColor(value) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function disposeMaterial(material) {
  if (!material) return;
  for (const key of ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "alphaMap"]) {
    material[key]?.dispose?.();
  }
  material.dispose?.();
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) disposeMaterial(material);
  });
}

export function resolveBallModelStyle(name) {
  return BALL_MODEL_STYLES[name] ?? BALL_MODEL_STYLES.classic;
}

export function projectChargeIndicator({ activeCharge, selectedPlayer, ballOwnerId } = {}) {
  const visible = Boolean(activeCharge && selectedPlayer && ballOwnerId && selectedPlayer.id === ballOwnerId);
  if (!visible) return Object.freeze({ visible: false, power: 0, urgent: false });
  const power = Math.max(0, Math.min(1, Number(activeCharge.power) || 0));
  return Object.freeze({ visible: true, power, urgent: power > 0.82 });
}

function createBallSurfaceTextures({ THREE, document, style, anisotropy }) {
  const width = 768;
  const height = 384;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = bumpCanvas.width = width;
  colorCanvas.height = bumpCanvas.height = height;
  const paint = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  paint.fillStyle = cssColor(style.base);
  paint.fillRect(0, 0, width, height);
  bump.fillStyle = "#d8d8d8";
  bump.fillRect(0, 0, width, height);
  const drawSeams = (target, color, lineWidth) => {
    target.strokeStyle = color;
    target.lineWidth = lineWidth;
    target.lineCap = "round";
    target.lineJoin = "round";
    for (let index = 0; index < 6; index += 1) {
      const x = (index + 0.5) * width / 6;
      target.beginPath();
      target.moveTo(x - 22, 0);
      target.bezierCurveTo(x + 42, height * 0.24, x - 40, height * 0.74, x + 20, height);
      target.stroke();
    }
    for (let row = 1; row < 4; row += 1) {
      const y = row * height / 4;
      target.beginPath();
      target.moveTo(0, y + 12);
      target.bezierCurveTo(width * 0.24, y - 26, width * 0.72, y + 24, width, y - 10);
      target.stroke();
    }
  };
  drawSeams(paint, style.stroke, 3.4);
  drawSeams(bump, "#444", 7);
  paint.fillStyle = cssColor(style.patch);
  paint.globalAlpha = 0.96;
  const panels = [[92, 76, -0.18], [244, 205, 0.22], [392, 98, -0.12], [548, 270, 0.18], [685, 146, -0.2], [78, 326, 0.14], [444, 332, -0.15]];
  for (const [x, y, rotation] of panels) {
    paint.save();
    paint.translate(x, y);
    paint.rotate(rotation);
    paint.beginPath();
    paint.moveTo(-28, -8);
    paint.quadraticCurveTo(-2, -28, 30, -14);
    paint.lineTo(18, 13);
    paint.quadraticCurveTo(-4, 26, -31, 10);
    paint.closePath();
    paint.fill();
    paint.restore();
  }
  paint.globalAlpha = 0.34;
  paint.fillStyle = "#ffffff";
  paint.fillRect(0, 0, width, 3);
  paint.globalAlpha = 1;
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.anisotropy = anisotropy;
  return { map, bumpMap };
}

export function createBallModelView({
  THREE,
  document,
  scenePort,
  worldX = (value) => (value - 600) * 0.1,
  worldZ = (value) => (value - 350) * 0.1,
} = {}) {
  if (!THREE || !document || !scenePort || typeof scenePort.addObject !== "function") {
    throw new TypeError("BallModelView requires THREE, document and a scene port");
  }
  const anisotropy = scenePort.diagnostics?.().maxAnisotropy || 1;
  const ballRoot = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0, clearcoat: 0.16, clearcoatRoughness: 0.7, bumpScale: 0.035 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.56, 48, 32), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ballRoot.add(mesh);

  const chargeRoot = new THREE.Group();
  const background = new THREE.Mesh(new THREE.BoxGeometry(5, 0.22, 0.28), new THREE.MeshBasicMaterial({ color: 0x080b0a, transparent: true, opacity: 0.8 }));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.24, 0.3), new THREE.MeshBasicMaterial({ color: 0xffcf58, toneMapped: false }));
  fill.position.y = 0.02;
  fill.userData.baseWidth = 4.8;
  chargeRoot.add(background, fill);
  chargeRoot.visible = false;
  scenePort.addObject(ballRoot);
  scenePort.addObject(chargeRoot);

  let currentStyle = null;
  let disposed = false;

  function applyStyle(name) {
    if (disposed || currentStyle === name) return false;
    const style = resolveBallModelStyle(name);
    material.map?.dispose?.();
    material.bumpMap?.dispose?.();
    const textures = createBallSurfaceTextures({ THREE, document, style, anisotropy });
    material.map = textures.map;
    material.bumpMap = textures.bumpMap;
    material.color.set(0xffffff);
    material.needsUpdate = true;
    currentStyle = BALL_MODEL_STYLES[name] ? name : "classic";
    return true;
  }

  applyStyle("classic");

  function render({ ball, selectedPlayer = null, ballOwnerId = null, activeCharge = null, ballStyle = "classic" } = {}) {
    if (disposed) return false;
    assertFrozenRecord(ball, "ball render state");
    if (selectedPlayer !== null) assertFrozenRecord(selectedPlayer, "selected player render state");
    applyStyle(ballStyle);
    ballRoot.position.set(worldX(ball.x), 0.58 + (ball.height || 0), worldZ(ball.y));
    ballRoot.rotation.set(ball.angle * 0.7, ball.angle, ball.angle * 0.35);
    const charge = projectChargeIndicator({ activeCharge, selectedPlayer, ballOwnerId });
    chargeRoot.visible = charge.visible;
    if (charge.visible) {
      chargeRoot.position.set(worldX(selectedPlayer.x), 7.5, worldZ(selectedPlayer.y));
      scenePort.copyCameraQuaternion(chargeRoot.quaternion);
      fill.scale.x = Math.max(0.02, charge.power);
      fill.position.x = -2.4 + 2.4 * charge.power;
      fill.material.color.set(charge.urgent ? 0xff5b45 : 0xffcf58);
    }
    return true;
  }

  function reset() {
    if (disposed) return false;
    ballRoot.position.set(0, 0.58, 0);
    ballRoot.rotation.set(0, 0, 0);
    chargeRoot.visible = false;
    return true;
  }

  function teardown() {
    if (disposed) return false;
    disposed = true;
    scenePort.removeObject(chargeRoot);
    scenePort.removeObject(ballRoot);
    disposeObject(chargeRoot);
    disposeObject(ballRoot);
    return true;
  }

  function diagnostics() {
    return Object.freeze({ owner: "ball-model-view", disposed, style: currentStyle, chargeVisible: chargeRoot.visible });
  }

  return Object.freeze({ render, reset, teardown, applyStyle, diagnostics });
}
