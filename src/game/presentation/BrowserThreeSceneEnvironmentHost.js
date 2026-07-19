import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { createThreeSceneHostPort } from "./ThreeSceneHostContract.js";

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 700;
const WORLD_SCALE = 0.1;
const FIELD = Object.freeze({ left: 48, right: 1152, top: 42, bottom: 658 });

const PITCH_STYLES = Object.freeze({
  classic: Object.freeze({ top: "#0b7547", mid: "#087044", bottom: "#075d39", outside: "#07100d", grass: 0x15915b, tint: 0xffffff, wet: 0xb7d8c8 }),
  elite: Object.freeze({ top: "#11915b", mid: "#0b8351", bottom: "#086b43", outside: "#07140f", grass: 0x20a869, tint: 0xf2fff8, wet: 0xa8d8c4 }),
  dry: Object.freeze({ top: "#8b9c4d", mid: "#74883e", bottom: "#637537", outside: "#16170d", grass: 0x879d4c, tint: 0xfff1cc, wet: 0xb8c39a }),
  midnight: Object.freeze({ top: "#075943", mid: "#064b38", bottom: "#043d2e", outside: "#030c09", grass: 0x08795a, tint: 0xc4e9dc, wet: 0x86b8a9 }),
});

const lerp = (start, end, amount) => start + (end - start) * amount;
const worldX = (value) => (value - WORLD_WIDTH / 2) * WORLD_SCALE;
const worldZ = (value) => (value - WORLD_HEIGHT / 2) * WORLD_SCALE;

function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function safeDispose(value) {
  value?.dispose?.();
}

function disposeMaterial(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    for (const value of Object.values(item)) {
      if (value?.isTexture) safeDispose(value);
    }
    safeDispose(item);
  }
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    safeDispose(node.geometry);
    disposeMaterial(node.material);
  });
}

function createPitchTexture({ document, renderer, style }) {
  const theme = PITCH_STYLES[style] ?? PITCH_STYLES.classic;
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = WORLD_WIDTH;
  textureCanvas.height = WORLD_HEIGHT;
  const paint = textureCanvas.getContext("2d");
  if (!paint) throw new Error("Pitch texture requires a 2D canvas context");

  paint.fillStyle = theme.outside;
  paint.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const grass = paint.createLinearGradient(0, FIELD.top, 0, FIELD.bottom);
  grass.addColorStop(0, theme.top);
  grass.addColorStop(0.5, theme.mid);
  grass.addColorStop(1, theme.bottom);
  paint.fillStyle = grass;
  paint.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);

  const stripe = (FIELD.right - FIELD.left) / 16;
  for (let index = 0; index < 16; index += 1) {
    paint.fillStyle = index % 2 ? "rgba(255,255,255,.035)" : "rgba(0,20,8,.05)";
    paint.fillRect(FIELD.left + index * stripe, FIELD.top, stripe, FIELD.bottom - FIELD.top);
  }
  for (let index = 0; index < 2600; index += 1) {
    const x = FIELD.left + seededNoise(index * 2.17) * (FIELD.right - FIELD.left);
    const y = FIELD.top + seededNoise(index * 5.43 + 9) * (FIELD.bottom - FIELD.top);
    paint.fillStyle = seededNoise(index * 8.1) > 0.48 ? "rgba(255,255,220,.035)" : "rgba(0,20,8,.04)";
    paint.fillRect(x, y, 1, 2);
  }

  paint.strokeStyle = "rgba(245,250,247,.94)";
  paint.lineWidth = 3;
  paint.lineCap = "round";
  paint.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
  paint.beginPath();
  paint.moveTo(WORLD_WIDTH / 2, FIELD.top);
  paint.lineTo(WORLD_WIDTH / 2, FIELD.bottom);
  paint.stroke();
  paint.beginPath();
  paint.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 83, 0, Math.PI * 2);
  paint.stroke();
  paint.fillStyle = "white";
  paint.beginPath();
  paint.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 5, 0, Math.PI * 2);
  paint.fill();
  paint.strokeRect(FIELD.left, 175, 180, 350);
  paint.strokeRect(FIELD.left, 267, 83, 166);
  paint.strokeRect(FIELD.right - 180, 175, 180, 350);
  paint.strokeRect(FIELD.right - 83, 267, 83, 166);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function addPitchDetails(scene) {
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xe9efec, metalness: 0.62, roughness: 0.32 });
  const flagColors = [0xe1bb58, 0x47c9d4, 0x47c9d4, 0xe1bb58];
  const corners = [[-55.2, -30.8], [-55.2, 30.8], [55.2, -30.8], [55.2, 30.8]];
  corners.forEach(([x, z], index) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.65, 8), poleMaterial);
    pole.position.set(x, 0.82, z);
    pole.castShadow = true;
    scene.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.45),
      new THREE.MeshStandardMaterial({ color: flagColors[index], side: THREE.DoubleSide, roughness: 0.55 }),
    );
    flag.position.set(x + (x < 0 ? 0.36 : -0.36), 1.42, z);
    flag.rotation.y = x < 0 ? 0 : Math.PI;
    scene.add(flag);
  });

  const canopyMaterial = new THREE.MeshPhysicalMaterial({ color: 0x8fb9ad, transparent: true, opacity: 0.2, roughness: 0.22, metalness: 0.25, side: THREE.DoubleSide });
  const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2927, roughness: 0.75 });
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(15, 0.12, 3.4), canopyMaterial);
    canopy.position.y = 2.15;
    canopy.rotation.x = side * 0.2;
    group.add(canopy);
    for (let index = -3; index <= 3; index += 1) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.65, 0.82), seatMaterial);
      seat.position.set(index * 1.65, 0.45, 0);
      group.add(seat);
    }
    group.position.set(0, 0, side * 35.1);
    scene.add(group);
  }
}

function createPitch({ scene, document, renderer, style }) {
  const theme = PITCH_STYLES[style] ?? PITCH_STYLES.classic;
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_WIDTH * WORLD_SCALE, WORLD_HEIGHT * WORLD_SCALE),
    new THREE.MeshStandardMaterial({ map: createPitchTexture({ document, renderer, style }), roughness: 0.94, metalness: 0 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);
  const base = new THREE.Mesh(new THREE.BoxGeometry(124, 1.2, 74), new THREE.MeshStandardMaterial({ color: 0x06130e, roughness: 1 }));
  base.position.y = -0.7;
  base.receiveShadow = true;
  scene.add(base);
  addPitchDetails(scene);
  return { pitch, dryColor: new THREE.Color(theme.tint), wetColor: new THREE.Color(theme.wet) };
}

function createGrass({ scene, style, lowPowerDevice }) {
  const theme = PITCH_STYLES[style] ?? PITCH_STYLES.classic;
  const count = lowPowerDevice ? 220 : 1800;
  const bladeGeometry = new THREE.PlaneGeometry(0.055, 0.42);
  bladeGeometry.translate(0, 0.21, 0);
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: theme.grass, roughness: 0.88, side: THREE.DoubleSide });
  const grass = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, count);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < count; index += 1) {
    dummy.position.set(
      worldX(FIELD.left + seededNoise(index * 2.13) * (FIELD.right - FIELD.left)),
      0.015,
      worldZ(FIELD.top + seededNoise(index * 5.71 + 3) * (FIELD.bottom - FIELD.top)),
    );
    dummy.rotation.y = seededNoise(index * 9.37) * Math.PI;
    const size = 0.65 + seededNoise(index * 4.43) * 0.7;
    dummy.scale.set(size, size, size);
    dummy.updateMatrix();
    grass.setMatrixAt(index, dummy.matrix);
  }
  grass.receiveShadow = true;
  grass.frustumCulled = false;
  scene.add(grass);
  return grass;
}

function createAtmosphere({ scene, lowPowerDevice }) {
  const drops = lowPowerDevice ? 180 : 820;
  const positions = new Float32Array(drops * 2 * 3);
  const speeds = new Float32Array(drops);
  for (let index = 0; index < drops; index += 1) {
    const x = -67 + seededNoise(index * 3.17) * 134;
    const y = 2 + seededNoise(index * 7.43) * 47;
    const z = -39 + seededNoise(index * 11.2) * 78;
    const offset = index * 6;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    positions[offset + 3] = x - 0.1;
    positions[offset + 4] = y - 0.9;
    positions[offset + 5] = z + 0.14;
    speeds[index] = 0.65 + seededNoise(index * 13.7) * 0.85;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xbfe9f2, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  rain.userData.speeds = speeds;
  scene.add(rain);
  return rain;
}

function createLedBoard({ scene, document, x, z, text, color, ledViews }) {
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(35, 1.7, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x030706, emissive: color, emissiveIntensity: 0.32, metalness: 0.35, roughness: 0.35 }),
  );
  board.position.set(x, 1.1, z);
  scene.add(board);
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 64;
  const paint = labelCanvas.getContext("2d");
  if (!paint) throw new Error("LED board requires a 2D canvas context");
  paint.fillStyle = "#050908";
  paint.fillRect(0, 0, 1024, 64);
  paint.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  paint.font = "700 28px Inter";
  paint.textAlign = "center";
  paint.textBaseline = "middle";
  paint.fillText(text, 512, 34);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(34.5, 1.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(labelCanvas), toneMapped: false, transparent: true }),
  );
  label.position.set(x, 1.1, z + (z > 0 ? -0.24 : 0.24));
  label.rotation.y = z > 0 ? Math.PI : 0;
  scene.add(label);
  ledViews.push({ board, label });
}

function createStadium({ scene, document, lowPowerDevice, ledViews, stadiumLights }) {
  const standMaterial = new THREE.MeshStandardMaterial({ color: 0x111918, roughness: 0.82, metalness: 0.12 });
  const tierMaterials = [
    standMaterial,
    new THREE.MeshStandardMaterial({ color: 0x17201f, roughness: 0.78, metalness: 0.16 }),
    new THREE.MeshStandardMaterial({ color: 0x1b2524, roughness: 0.75, metalness: 0.18 }),
  ];
  for (let tier = 0; tier < 3; tier += 1) {
    const y = 1.6 + tier * 2.3;
    const longDepth = 4.2 + tier * 1.2;
    for (const zSide of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(128, 2.1, longDepth), tierMaterials[tier]);
      mesh.position.set(0, y, zSide * (38.2 + tier * 3.1));
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    for (const xSide of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(longDepth, 2.1, 76), tierMaterials[tier]);
      mesh.position.set(xSide * (64.5 + tier * 3.1), y, 0);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  const roofMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1a2425, roughness: 0.35, metalness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.5 });
  for (const [x, y, z, width, height, depth] of [[0, 9.8, -47, 136, 0.5, 11], [0, 9.8, 47, 136, 0.5, 11], [-73, 9.8, 0, 10, 0.5, 84], [73, 9.8, 0, 10, 0.5, 84]]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), roofMaterial);
    roof.position.set(x, y, z);
    roof.castShadow = true;
    scene.add(roof);
  }
  if (!lowPowerDevice) {
    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x53605d, metalness: 0.8, roughness: 0.28 });
    for (let index = -5; index <= 5; index += 1) {
      for (const z of [-43, 43]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.5, 0.24), beamMaterial);
        beam.position.set(index * 11, 7, z);
        scene.add(beam);
      }
    }
    for (let index = -2; index <= 2; index += 1) {
      for (const x of [-68, 68]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.5, 0.24), beamMaterial);
        beam.position.set(x, 7, index * 14);
        scene.add(beam);
      }
    }
  }
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 5.5), new THREE.MeshStandardMaterial({ color: 0x030606, roughness: 0.94 }));
  tunnel.position.set(0, 2.1, 39);
  scene.add(tunnel);

  const crowdPositions = [];
  const crowdColors = [];
  const crowdCount = lowPowerDevice ? 360 : 1900;
  for (let index = 0; index < crowdCount; index += 1) {
    const edge = index % 4;
    const row = 1 + Math.floor(seededNoise(index * 8.3) * 4);
    let x;
    let z;
    if (edge < 2) {
      x = -61 + seededNoise(index * 2.8) * 122;
      z = edge === 0 ? -36 - row * 1.4 : 36 + row * 0.9;
    } else {
      x = edge === 2 ? -61 - row * 1.3 : 61 + row * 1.3;
      z = -33 + seededNoise(index * 4.7) * 66;
    }
    crowdPositions.push(x, 1.6 + row * 0.75 + seededNoise(index) * 0.7, z);
    const roll = seededNoise(index * 12.7);
    const color = new THREE.Color(roll > 0.93 ? 0xe1bb58 : roll > 0.86 ? 0x47c9d4 : 0x9ca9a3);
    crowdColors.push(color.r, color.g, color.b);
  }
  const crowdGeometry = new THREE.BufferGeometry();
  crowdGeometry.setAttribute("position", new THREE.Float32BufferAttribute(crowdPositions, 3));
  crowdGeometry.setAttribute("color", new THREE.Float32BufferAttribute(crowdColors, 3));
  const crowd = new THREE.Points(crowdGeometry, new THREE.PointsMaterial({ size: 0.34, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
  scene.add(crowd);

  createLedBoard({ scene, document, x: 0, z: -35.1, text: "TONY FOOTBALL MAX", color: 0xe1bb58, ledViews });
  createLedBoard({ scene, document, x: 0, z: 35.2, text: "PLAY BEAUTIFUL · PLAY TONY", color: 0x47c9d4, ledViews });
  for (const x of [-49, 49]) {
    for (const z of [-36, 36]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 21, 8), new THREE.MeshStandardMaterial({ color: 0x59615e, metalness: 0.8, roughness: 0.35 }));
      mast.position.set(x, 10, z);
      scene.add(mast);
      const lamp = new THREE.PointLight(0xe8fff5, 20, 70, 2);
      lamp.position.set(x, 20, z);
      scene.add(lamp);
      stadiumLights.push(lamp);
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(8, 28, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xbdebdc, transparent: true, opacity: lowPowerDevice ? 0.018 : 0.035, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      beam.position.set(x, 6, z);
      beam.rotation.z = Math.PI;
      scene.add(beam);
    }
  }
  return crowd;
}

function createGoal({ scene, x, side, nets }) {
  const goal = new THREE.Group();
  goal.position.x = x;
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f7f5, roughness: 0.28, metalness: 0.28 });
  const postGeometry = new THREE.CylinderGeometry(0.12, 0.12, 3.5, 10);
  const crossGeometry = new THREE.CylinderGeometry(0.12, 0.12, 17, 10);
  crossGeometry.rotateX(Math.PI / 2);
  for (const z of [-8.5, 8.5]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(0, 1.75, z);
    post.castShadow = true;
    goal.add(post);
  }
  const cross = new THREE.Mesh(crossGeometry, postMaterial);
  cross.position.set(0, 3.5, 0);
  goal.add(cross);
  const netMaterial = new THREE.LineBasicMaterial({ color: 0xbfd1c8, transparent: true, opacity: 0.34 });
  const netVertices = [];
  for (let z = -8.5; z <= 8.5; z += 1.7) netVertices.push(0, 0, z, side * 3, 0, z, 0, 3.5, z, side * 3, 2.8, z);
  for (let y = 0; y <= 3.5; y += 0.7) netVertices.push(0, y, -8.5, side * 3, y * 0.8, -8.5, 0, y, 8.5, side * 3, y * 0.8, 8.5, side * 3, y * 0.8, -8.5, side * 3, y * 0.8, 8.5);
  const netGeometry = new THREE.BufferGeometry();
  netGeometry.setAttribute("position", new THREE.Float32BufferAttribute(netVertices, 3));
  const net = new THREE.LineSegments(netGeometry, netMaterial);
  goal.add(net);
  nets.push(net);
  scene.add(goal);
}

function createComposer({ renderer, scene, camera, viewport, lowPowerDevice }) {
  if (lowPowerDevice) return null;
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(viewport.pixelRatio, 2));
  composer.setSize(viewport.width, viewport.height);
  composer.addPass(new RenderPass(scene, camera));
  const ssao = new SSAOPass(scene, camera, viewport.width, viewport.height, 24);
  ssao.kernelRadius = 10;
  ssao.minDistance = 0.002;
  ssao.maxDistance = 0.12;
  composer.addPass(ssao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(viewport.width, viewport.height), 0.16, 0.48, 0.88));
  composer.addPass(new SMAAPass(viewport.width * viewport.pixelRatio, viewport.height * viewport.pixelRatio));
  composer.addPass(new OutputPass());
  return composer;
}

export function createBrowserThreeSceneEnvironmentHost({ canvas, target, document, viewport, lowPowerDevice = false } = {}) {
  if (!canvas || !target || !document || !viewport) throw new TypeError("Browser Three scene host requires canvas, target, document and viewport");

  let renderer = null;
  let composer = null;
  let scene = null;
  let camera = null;
  let pitch = null;
  let grass = null;
  let crowd = null;
  let rain = null;
  let dryPitchColor = null;
  let wetPitchColor = null;
  let environmentTexture = null;
  let lastNow = null;
  let currentPitchStyle = "classic";
  let currentWeather = "clear";
  const ledViews = [];
  const goalNetViews = [];
  const stadiumLights = [];

  function start() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: lowPowerDevice, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(viewport.pixelRatio, lowPowerDevice ? 1.1 : 2));
    renderer.setSize(viewport.width, viewport.height, false);
    renderer.shadowMap.enabled = !lowPowerDevice;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050a09);
    scene.fog = new THREE.FogExp2(0x07110e, 0.011);
    camera = new THREE.PerspectiveCamera(lowPowerDevice ? 43 : 39, viewport.width / viewport.height, 0.1, 260);
    camera.position.set(0, lowPowerDevice ? 54 : 45, lowPowerDevice ? 63 : 52);
    camera.lookAt(0, 0, 0);

    if (!lowPowerDevice) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = new RoomEnvironment();
      environmentTexture = pmrem.fromScene(environment, 0.04).texture;
      scene.environment = environmentTexture;
      scene.environmentIntensity = 0.62;
      environment.dispose();
      pmrem.dispose();
    }

    const hemisphere = new THREE.HemisphereLight(0xcfffe7, 0x06120d, 1.45);
    scene.add(hemisphere);
    const flood = new THREE.DirectionalLight(0xffffff, 3.4);
    flood.position.set(-28, 62, 30);
    flood.castShadow = true;
    flood.shadow.mapSize.set(lowPowerDevice ? 512 : 2048, lowPowerDevice ? 512 : 2048);
    flood.shadow.camera.left = -72;
    flood.shadow.camera.right = 72;
    flood.shadow.camera.top = 50;
    flood.shadow.camera.bottom = -50;
    flood.shadow.bias = -0.00035;
    scene.add(flood);
    const rim = new THREE.DirectionalLight(0x70dcff, 1.4);
    rim.position.set(48, 25, -35);
    scene.add(rim);

    const pitchResources = createPitch({ scene, document, renderer, style: currentPitchStyle });
    pitch = pitchResources.pitch;
    dryPitchColor = pitchResources.dryColor;
    wetPitchColor = pitchResources.wetColor;
    grass = createGrass({ scene, style: currentPitchStyle, lowPowerDevice });
    crowd = createStadium({ scene, document, lowPowerDevice, ledViews, stadiumLights });
    createGoal({ scene, x: worldX(FIELD.left), side: -1, nets: goalNetViews });
    createGoal({ scene, x: worldX(FIELD.right), side: 1, nets: goalNetViews });
    rain = createAtmosphere({ scene, lowPowerDevice });
    composer = createComposer({ renderer, scene, camera, viewport, lowPowerDevice });
  }

  function resize(nextViewport) {
    if (!renderer || !camera) return false;
    camera.aspect = nextViewport.width / nextViewport.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(nextViewport.pixelRatio, lowPowerDevice ? 1.1 : 2));
    renderer.setSize(nextViewport.width, nextViewport.height, false);
    composer?.setPixelRatio?.(Math.min(nextViewport.pixelRatio, 2));
    composer?.setSize?.(nextViewport.width, nextViewport.height);
    return true;
  }

  function applyPitchStyle(style) {
    if (!renderer || !scene || !pitch || !grass || style === currentPitchStyle) return;
    currentPitchStyle = PITCH_STYLES[style] ? style : "classic";
    const theme = PITCH_STYLES[currentPitchStyle];
    pitch.material.map?.dispose?.();
    pitch.material.map = createPitchTexture({ document, renderer, style: currentPitchStyle });
    pitch.material.needsUpdate = true;
    grass.material.color.set(theme.grass);
    dryPitchColor.set(theme.tint);
    wetPitchColor.set(theme.wet);
  }

  function updateAtmosphere(frame) {
    const settings = frame?.snapshot?.settings ?? {};
    applyPitchStyle(settings.pitchStyle ?? "classic");
    currentWeather = settings.weather === "rain" ? "rain" : "clear";
    if (!rain || !pitch) return;
    const now = Number(frame?.nowMilliseconds ?? 0);
    const raining = currentWeather === "rain";
    rain.visible = raining;
    pitch.material.roughness = lerp(pitch.material.roughness, raining ? 0.42 : 0.94, 0.04);
    pitch.material.metalness = lerp(pitch.material.metalness, raining ? 0.08 : 0, 0.04);
    pitch.material.color.lerp(raining ? wetPitchColor : dryPitchColor, 0.04);
    if (raining) {
      const previous = lastNow ?? now;
      const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      const positions = rain.geometry.attributes.position.array;
      const speeds = rain.userData.speeds;
      for (let index = 0; index < speeds.length; index += 1) {
        const offset = index * 6;
        const fall = speeds[index] * 30 * delta;
        positions[offset] -= 2.6 * delta;
        positions[offset + 3] -= 2.6 * delta;
        positions[offset + 1] -= fall;
        positions[offset + 4] -= fall;
        if (positions[offset + 1] < 0.5) {
          positions[offset + 1] = 48;
          positions[offset + 4] = 47.1;
        }
        if (positions[offset] < -70) {
          positions[offset] += 140;
          positions[offset + 3] += 140;
        }
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    lastNow = now;
  }

  function render(frame) {
    if (!renderer || !scene || !camera) return false;
    updateAtmosphere(frame);
    if (composer) composer.render();
    else renderer.render(scene, camera);
    return true;
  }

  function reset() {
    lastNow = null;
    if (rain) rain.userData.lastTime = null;
    return true;
  }

  function dispose() {
    const errors = [];
    const attempt = (operation) => {
      try { operation(); } catch (error) { errors.push(error); }
    };
    attempt(() => disposeObject(scene));
    attempt(() => safeDispose(environmentTexture));
    attempt(() => composer?.dispose?.());
    attempt(() => renderer?.dispose?.());
    attempt(() => renderer?.forceContextLoss?.());
    renderer = null;
    composer = null;
    scene = null;
    camera = null;
    pitch = null;
    grass = null;
    crowd = null;
    rain = null;
    dryPitchColor = null;
    wetPitchColor = null;
    environmentTexture = null;
    ledViews.length = 0;
    goalNetViews.length = 0;
    stadiumLights.length = 0;
    lastNow = null;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Three scene host disposal failed");
    return true;
  }

  const port = createThreeSceneHostPort({
    addObject: (object) => {
      if (!scene || !object) return false;
      scene.add(object);
      return true;
    },
    removeObject: (object) => {
      if (!scene || !object) return false;
      scene.remove(object);
      return true;
    },
    setCameraPose: (pose) => {
      if (!camera) return false;
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
      return true;
    },
    copyCameraQuaternion: (destination) => {
      if (!camera || !destination?.copy) return false;
      destination.copy(camera.quaternion);
      return true;
    },
    requestRender: () => render(Object.freeze({ snapshot: Object.freeze({ settings: Object.freeze({ pitchStyle: currentPitchStyle, weather: currentWeather }) }), nowMilliseconds: lastNow ?? 0 })),
    diagnostics: () => Object.freeze({
      renderer: renderer ? "webgl" : "unavailable",
      composer: Boolean(composer),
      lowPowerDevice: Boolean(lowPowerDevice),
      pitchStyle: currentPitchStyle,
      weather: currentWeather,
      sceneObjects: scene?.children?.length ?? 0,
    }),
  });

  return Object.freeze({ port, start, resize, render, reset, dispose });
}
