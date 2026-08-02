import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { createThreeSceneHostPort } from "./ThreeSceneHostContract.js";
import {
  createThreeSceneEnvironmentProfile,
  DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE,
} from "./ThreeSceneEnvironmentProfile.js";

const lerp = (start, end, amount) => start + (end - start) * amount;
const worldX = (value, geometry) => (value - geometry.worldWidth / 2) * geometry.worldScale;
const worldZ = (value, geometry) => (value - geometry.worldHeight / 2) * geometry.worldScale;


function stadiumEnvelope(profile) {
  const { geometry } = profile;
  const worldHalfX = geometry.worldWidth * geometry.worldScale / 2;
  const worldHalfZ = geometry.worldHeight * geometry.worldScale / 2;
  return Object.freeze({
    sidelineStandZ: worldHalfZ + 6.5,
    endlineStandX: worldHalfX + 6.5,
    canopyZ: worldHalfZ + 4.5,
    ledZ: worldHalfZ + 4,
    roofZ: worldHalfZ + 12.5,
    roofX: worldHalfX + 12.5,
    tunnelZ: worldHalfZ + 6,
    mastX: worldHalfX + 2,
    mastZ: worldHalfZ + 5,
  });
}

function pitchViewportCoverage(camera, profile) {
  if (!camera) return null;
  const { geometry } = profile;
  const { field } = geometry;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const corners = [
    [field.left, field.top],
    [field.right, field.top],
    [field.right, field.bottom],
    [field.left, field.bottom],
  ].map(([x, z]) => {
    const projected = new THREE.Vector3(worldX(x, geometry), 0, worldZ(z, geometry)).project(camera);
    return Object.freeze({ x: projected.x, y: projected.y, z: projected.z });
  });
  if (!corners.every((corner) => Number.isFinite(corner.x) && Number.isFinite(corner.y) && Number.isFinite(corner.z))) return null;

  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const raw = Object.freeze({
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.max(...ys),
    bottom: Math.min(...ys),
  });
  const visible = Object.freeze({
    left: Math.max(-1, raw.left),
    right: Math.min(1, raw.right),
    top: Math.min(1, raw.top),
    bottom: Math.max(-1, raw.bottom),
  });
  const widthRatio = Math.max(0, visible.right - visible.left) / 2;
  const heightRatio = Math.max(0, visible.top - visible.bottom) / 2;
  return Object.freeze({
    widthRatio,
    heightRatio,
    boundingAreaRatio: widthRatio * heightRatio,
    fullyVisible: corners.every((corner) => Math.abs(corner.x) <= 1 && Math.abs(corner.y) <= 1 && corner.z >= -1 && corner.z <= 1),
    visibleCornerCount: corners.filter((corner) => Math.abs(corner.x) <= 1 && Math.abs(corner.y) <= 1 && corner.z >= -1 && corner.z <= 1).length,
    raw,
    visible,
    corners: Object.freeze(corners),
  });
}

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

function createPitchTexture({ document, renderer, style, profile }) {
  const theme = profile.pitchStyles[style] ?? profile.pitchStyles.classic;
  const { worldWidth, worldHeight, field, markings, goal } = profile.geometry;
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = worldWidth;
  textureCanvas.height = worldHeight;
  const paint = textureCanvas.getContext("2d");
  if (!paint) throw new Error("Pitch texture requires a 2D canvas context");

  paint.fillStyle = theme.outside;
  paint.fillRect(0, 0, worldWidth, worldHeight);
  const grass = paint.createLinearGradient(0, field.top, 0, field.bottom);
  grass.addColorStop(0, theme.top);
  grass.addColorStop(0.5, theme.mid);
  grass.addColorStop(1, theme.bottom);
  paint.fillStyle = grass;
  paint.fillRect(field.left, field.top, field.right - field.left, field.bottom - field.top);

  const stripe = (field.right - field.left) / 16;
  for (let index = 0; index < 16; index += 1) {
    paint.fillStyle = index % 2 ? "rgba(255,255,255,.035)" : "rgba(0,20,8,.05)";
    paint.fillRect(field.left + index * stripe, field.top, stripe, field.bottom - field.top);
  }
  for (let index = 0; index < 2600; index += 1) {
    const x = field.left + seededNoise(index * 2.17) * (field.right - field.left);
    const y = field.top + seededNoise(index * 5.43 + 9) * (field.bottom - field.top);
    paint.fillStyle = seededNoise(index * 8.1) > 0.48 ? "rgba(255,255,220,.035)" : "rgba(0,20,8,.04)";
    paint.fillRect(x, y, 1, 2);
  }

  paint.strokeStyle = "rgba(245,250,247,.94)";
  paint.lineWidth = markings.lineWidthSimulation;
  paint.lineCap = "round";
  paint.strokeRect(field.left, field.top, field.right - field.left, field.bottom - field.top);
  paint.beginPath();
  paint.moveTo(worldWidth / 2, field.top);
  paint.lineTo(worldWidth / 2, field.bottom);
  paint.stroke();
  paint.beginPath();
  paint.arc(worldWidth / 2, worldHeight / 2, markings.centreCircleRadiusSimulation, 0, Math.PI * 2);
  paint.stroke();
  paint.fillStyle = "white";
  paint.beginPath();
  paint.arc(worldWidth / 2, worldHeight / 2, markings.centreSpotRadiusSimulation, 0, Math.PI * 2);
  paint.fill();

  const centreY = worldHeight / 2;
  const penaltyTop = centreY - markings.penaltyAreaWidthSimulation / 2;
  const goalAreaTop = centreY - markings.goalAreaWidthSimulation / 2;
  paint.strokeRect(field.left, penaltyTop, markings.penaltyAreaDepthSimulation, markings.penaltyAreaWidthSimulation);
  paint.strokeRect(field.left, goalAreaTop, markings.goalAreaDepthSimulation, markings.goalAreaWidthSimulation);
  paint.strokeRect(field.right - markings.penaltyAreaDepthSimulation, penaltyTop, markings.penaltyAreaDepthSimulation, markings.penaltyAreaWidthSimulation);
  paint.strokeRect(field.right - markings.goalAreaDepthSimulation, goalAreaTop, markings.goalAreaDepthSimulation, markings.goalAreaWidthSimulation);
  for (const side of [-1, 1]) {
    paint.beginPath();
    paint.arc(
      side < 0 ? field.left + markings.penaltyMarkDistanceSimulation : field.right - markings.penaltyMarkDistanceSimulation,
      centreY,
      markings.centreSpotRadiusSimulation,
      0,
      Math.PI * 2,
    );
    paint.fill();
  }

  paint.lineWidth = goal.postThickness * profile.geometry.worldScale ** -1;
  paint.strokeRect(field.left - goal.depth / profile.geometry.worldScale, goal.top, goal.depth / profile.geometry.worldScale, goal.bottom - goal.top);
  paint.strokeRect(field.right, goal.top, goal.depth / profile.geometry.worldScale, goal.bottom - goal.top);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function addPitchDetails(scene, profile) {
  const envelope = stadiumEnvelope(profile);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xe9efec, metalness: 0.62, roughness: 0.32 });
  const flagColors = [0xe1bb58, 0x47c9d4, 0x47c9d4, 0xe1bb58];
  const { geometry } = profile;
  const { field } = geometry;
  const corners = [
    [worldX(field.left, geometry), worldZ(field.top, geometry)],
    [worldX(field.left, geometry), worldZ(field.bottom, geometry)],
    [worldX(field.right, geometry), worldZ(field.top, geometry)],
    [worldX(field.right, geometry), worldZ(field.bottom, geometry)],
  ];
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
    group.position.set(0, 0, side * envelope.canopyZ);
    scene.add(group);
  }
}

function createPitch({ scene, document, renderer, style, profile }) {
  const theme = profile.pitchStyles[style] ?? profile.pitchStyles.classic;
  const { worldWidth, worldHeight, worldScale } = profile.geometry;
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth * worldScale, worldHeight * worldScale),
    new THREE.MeshStandardMaterial({ map: createPitchTexture({ document, renderer, style, profile }), roughness: 0.94, metalness: 0 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(worldWidth * worldScale + 4, 1.2, worldHeight * worldScale + 4),
    new THREE.MeshStandardMaterial({ color: 0x06130e, roughness: 1 }),
  );
  base.position.y = -0.7;
  base.receiveShadow = true;
  scene.add(base);
  addPitchDetails(scene, profile);
  return { pitch, dryColor: new THREE.Color(theme.tint), wetColor: new THREE.Color(theme.wet) };
}

function createGrass({ scene, style, lowPowerDevice, profile }) {
  const theme = profile.pitchStyles[style] ?? profile.pitchStyles.classic;
  const { geometry } = profile;
  const { field } = geometry;
  const count = lowPowerDevice ? 220 : 1800;
  const bladeGeometry = new THREE.PlaneGeometry(0.055, 0.42);
  bladeGeometry.translate(0, 0.21, 0);
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: theme.grass, roughness: 0.88, side: THREE.DoubleSide });
  const grass = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, count);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < count; index += 1) {
    dummy.position.set(
      worldX(field.left + seededNoise(index * 2.13) * (field.right - field.left), geometry),
      0.015,
      worldZ(field.top + seededNoise(index * 5.71 + 3) * (field.bottom - field.top), geometry),
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

function createStadium({ scene, document, lowPowerDevice, ledViews, stadiumLights, profile }) {
  const envelope = stadiumEnvelope(profile);
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
      mesh.position.set(0, y, zSide * (envelope.sidelineStandZ + tier * 2.4));
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    for (const xSide of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(longDepth, 2.1, 76), tierMaterials[tier]);
      mesh.position.set(xSide * (envelope.endlineStandX + tier * 2.4), y, 0);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  const roofMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1a2425, roughness: 0.35, metalness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.5 });
  for (const [x, y, z, width, height, depth] of [[0, 9.8, -envelope.roofZ, 86, 0.5, 9], [0, 9.8, envelope.roofZ, 86, 0.5, 9], [-envelope.roofX, 9.8, 0, 8, 0.5, 58], [envelope.roofX, 9.8, 0, 8, 0.5, 58]]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), roofMaterial);
    roof.position.set(x, y, z);
    roof.castShadow = true;
    scene.add(roof);
  }
  if (!lowPowerDevice) {
    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x53605d, metalness: 0.8, roughness: 0.28 });
    for (let index = -5; index <= 5; index += 1) {
      for (const z of [-envelope.sidelineStandZ - 4, envelope.sidelineStandZ + 4]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.5, 0.24), beamMaterial);
        beam.position.set(index * 11, 7, z);
        scene.add(beam);
      }
    }
    for (let index = -2; index <= 2; index += 1) {
      for (const x of [-envelope.endlineStandX - 4, envelope.endlineStandX + 4]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.5, 0.24), beamMaterial);
        beam.position.set(x, 7, index * 14);
        scene.add(beam);
      }
    }
  }
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 5.5), new THREE.MeshStandardMaterial({ color: 0x030606, roughness: 0.94 }));
  tunnel.position.set(0, 2.1, envelope.tunnelZ);
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
      x = -envelope.endlineStandX + 2 + seededNoise(index * 2.8) * (envelope.endlineStandX * 2 - 4);
      z = edge === 0 ? -envelope.sidelineStandZ - row * 1.05 : envelope.sidelineStandZ + row * 1.05;
    } else {
      x = edge === 2 ? -envelope.endlineStandX - row * 1.05 : envelope.endlineStandX + row * 1.05;
      z = -envelope.sidelineStandZ + 2 + seededNoise(index * 4.7) * (envelope.sidelineStandZ * 2 - 4);
    }
    crowdPositions.push(x, 1.6 + row * 0.75 + seededNoise(index) * 0.7, z);
    const roll = seededNoise(index * 12.7);
    const color = new THREE.Color(roll > 0.93 ? 0xe1bb58 : roll > 0.86 ? 0x47c9d4 : 0x9ca9a3);
    crowdColors.push(color.r, color.g, color.b);
  }
  const crowdGeometry = new THREE.BufferGeometry();
  crowdGeometry.setAttribute("position", new THREE.Float32BufferAttribute(crowdPositions, 3));
  crowdGeometry.setAttribute("color", new THREE.Float32BufferAttribute(crowdColors, 3));
  const crowd = new THREE.Points(
    crowdGeometry,
    new THREE.PointsMaterial({ size: 0.34, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9 }),
  );
  scene.add(crowd);

  createLedBoard({ scene, document, x: 0, z: -envelope.ledZ, text: "TONY FOOTBALL MAX", color: 0xe1bb58, ledViews });
  createLedBoard({ scene, document, x: 0, z: envelope.ledZ, text: "PLAY BEAUTIFUL · PLAY TONY", color: 0x47c9d4, ledViews });
  for (const x of [-envelope.mastX, envelope.mastX]) {
    for (const z of [-envelope.mastZ, envelope.mastZ]) {
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

function createGoal({ scene, x, side, nets, profile }) {
  const { goal } = profile.geometry;
  const goalObject = new THREE.Group();
  goalObject.position.x = x;
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f7f5, roughness: 0.28, metalness: 0.28 });
  const postHeight = goal.height + goal.postThickness;
  const postGeometry = new THREE.CylinderGeometry(goal.postRadius, goal.postRadius, postHeight, 10);
  const crossGeometry = new THREE.CylinderGeometry(goal.postRadius, goal.postRadius, goal.width, 10);
  crossGeometry.rotateX(Math.PI / 2);
  const halfWidth = goal.width / 2;
  for (const z of [-halfWidth, halfWidth]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(0, postHeight / 2, z);
    post.castShadow = true;
    goalObject.add(post);
  }
  const cross = new THREE.Mesh(crossGeometry, postMaterial);
  cross.position.set(0, goal.height + goal.postRadius, 0);
  goalObject.add(cross);
  const netMaterial = new THREE.LineBasicMaterial({ color: 0xbfd1c8, transparent: true, opacity: 0.34 });
  const netVertices = [];
  for (let z = -halfWidth; z <= halfWidth + 0.001; z += goal.width / 10) {
    netVertices.push(0, 0, z, side * goal.depth, 0, z, 0, goal.height, z, side * goal.depth, goal.height * 0.8, z);
  }
  for (let y = 0; y <= goal.height + 0.001; y += goal.height / 5) {
    netVertices.push(
      0, y, -halfWidth, side * goal.depth, y * 0.8, -halfWidth,
      0, y, halfWidth, side * goal.depth, y * 0.8, halfWidth,
      side * goal.depth, y * 0.8, -halfWidth, side * goal.depth, y * 0.8, halfWidth,
    );
  }
  const netGeometry = new THREE.BufferGeometry();
  netGeometry.setAttribute("position", new THREE.Float32BufferAttribute(netVertices, 3));
  const net = new THREE.LineSegments(netGeometry, netMaterial);
  goalObject.add(net);
  nets.push(net);
  scene.add(goalObject);
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

function defaultRendererFactory({ canvas, lowPowerDevice }) {
  return new THREE.WebGLRenderer({ canvas, antialias: lowPowerDevice, alpha: false, powerPreference: "high-performance" });
}

export function createBrowserThreeSceneEnvironmentHost({
  canvas,
  target,
  document,
  viewport,
  lowPowerDevice = false,
  profile = DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE,
  rendererFactory = defaultRendererFactory,
} = {}) {
  if (!canvas || !target || !document || !viewport) throw new TypeError("Browser Three scene host requires canvas, target, document and viewport");
  if (typeof rendererFactory !== "function") throw new TypeError("rendererFactory must be a function");
  const activeProfile = createThreeSceneEnvironmentProfile(profile);
  const { geometry, renderer: rendererProfile, camera: cameraProfile, lighting } = activeProfile;

  let renderer = null;
  let composer = null;
  let scene = null;
  let environmentRoot = null;
  let camera = null;
  let pitch = null;
  let grass = null;
  let crowd = null;
  let rain = null;
  let hemisphere = null;
  let flood = null;
  let rim = null;
  let dryPitchColor = null;
  let wetPitchColor = null;
  let environmentTexture = null;
  let lastCameraPose = null;
  let lastNow = null;
  let currentPitchStyle = "classic";
  let currentWeather = "clear";
  const ledViews = [];
  const goalNetViews = [];
  const stadiumLights = [];
  const foreignObjects = new Set();

  function applyEnvironmentStyle(style) {
    const theme = activeProfile.pitchStyles[style] ?? activeProfile.pitchStyles.classic;
    const environment = theme.environment;
    scene?.background?.set?.(environment.background ?? rendererProfile.background);
    scene?.fog?.color?.set?.(environment.fogColor ?? rendererProfile.fogColor);
    if (renderer) renderer.toneMappingExposure = environment.exposure ?? rendererProfile.exposure;
    if (hemisphere) hemisphere.intensity = environment.hemisphere ?? lighting.hemisphere.intensity;
    if (flood) flood.intensity = environment.flood ?? lighting.flood.intensity;
    if (rim) rim.intensity = environment.rim ?? lighting.rim.intensity;
    for (const lamp of stadiumLights) lamp.intensity = environment.stadium ?? lighting.stadium.intensity;
  }

  function start() {
    if (renderer) return false;
    renderer = rendererFactory({ canvas, lowPowerDevice, profile: activeProfile });
    renderer.setPixelRatio(Math.min(viewport.pixelRatio, lowPowerDevice ? 1.1 : 2));
    renderer.setSize(viewport.width, viewport.height, false);
    renderer.shadowMap.enabled = !lowPowerDevice;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = rendererProfile.exposure;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(rendererProfile.background);
    scene.fog = new THREE.FogExp2(rendererProfile.fogColor, rendererProfile.fogDensity);
    environmentRoot = new THREE.Group();
    environmentRoot.name = "tony-three-scene-environment";
    scene.add(environmentRoot);

    const cameraPosition = lowPowerDevice ? cameraProfile.lowPowerPosition : cameraProfile.position;
    camera = new THREE.PerspectiveCamera(
      lowPowerDevice ? cameraProfile.lowPowerFov : cameraProfile.fov,
      viewport.width / viewport.height,
      cameraProfile.near,
      cameraProfile.far,
    );
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
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

    hemisphere = new THREE.HemisphereLight(lighting.hemisphere.skyColor, lighting.hemisphere.groundColor, lighting.hemisphere.intensity);
    environmentRoot.add(hemisphere);
    flood = new THREE.DirectionalLight(lighting.flood.color, lighting.flood.intensity);
    flood.position.set(lighting.flood.position.x, lighting.flood.position.y, lighting.flood.position.z);
    flood.castShadow = true;
    const shadowMapSize = lowPowerDevice ? lighting.flood.lowPowerShadowMapSize : lighting.flood.shadowMapSize;
    flood.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    flood.shadow.camera.left = lighting.flood.shadowBounds.left;
    flood.shadow.camera.right = lighting.flood.shadowBounds.right;
    flood.shadow.camera.top = lighting.flood.shadowBounds.top;
    flood.shadow.camera.bottom = lighting.flood.shadowBounds.bottom;
    flood.shadow.bias = lighting.flood.shadowBias;
    environmentRoot.add(flood);
    rim = new THREE.DirectionalLight(lighting.rim.color, lighting.rim.intensity);
    rim.position.set(lighting.rim.position.x, lighting.rim.position.y, lighting.rim.position.z);
    environmentRoot.add(rim);

    const pitchResources = createPitch({ scene: environmentRoot, document, renderer, style: currentPitchStyle, profile: activeProfile });
    pitch = pitchResources.pitch;
    dryPitchColor = pitchResources.dryColor;
    wetPitchColor = pitchResources.wetColor;
    grass = createGrass({ scene: environmentRoot, style: currentPitchStyle, lowPowerDevice, profile: activeProfile });
    crowd = createStadium({ scene: environmentRoot, document, lowPowerDevice, ledViews, stadiumLights, profile: activeProfile });
    createGoal({ scene: environmentRoot, x: worldX(geometry.field.left, geometry), side: -1, nets: goalNetViews, profile: activeProfile });
    createGoal({ scene: environmentRoot, x: worldX(geometry.field.right, geometry), side: 1, nets: goalNetViews, profile: activeProfile });
    rain = createAtmosphere({ scene: environmentRoot, lowPowerDevice });
    composer = createComposer({ renderer, scene, camera, viewport, lowPowerDevice });
    applyEnvironmentStyle(currentPitchStyle);
    return true;
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
    if (!renderer || !scene || !pitch || !grass) return;
    const nextStyle = activeProfile.pitchStyles[style] ? style : "classic";
    if (nextStyle !== currentPitchStyle) {
      currentPitchStyle = nextStyle;
      const theme = activeProfile.pitchStyles[currentPitchStyle];
      pitch.material.map?.dispose?.();
      pitch.material.map = createPitchTexture({ document, renderer, style: currentPitchStyle, profile: activeProfile });
      pitch.material.needsUpdate = true;
      grass.material.color.set(theme.grass);
      dryPitchColor.set(theme.tint);
      wetPitchColor.set(theme.wet);
    }
    applyEnvironmentStyle(currentPitchStyle);
  }

  function updateAtmosphere(frame) {
    const settings = frame?.snapshot?.match?.settings ?? frame?.snapshot?.settings ?? {};
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

  function updateCelebration(frame) {
    const active = Boolean(frame?.snapshot?.match?.replay?.active);
    const now = Number(frame?.nowMilliseconds ?? 0);
    const pulse = active ? 1 + Math.sin(now * 0.018) * 0.45 : 1;
    if (crowd) {
      crowd.material.size = (lowPowerDevice ? 0.3 : 0.34) * pulse;
      crowd.material.opacity = active ? 0.98 : 0.88;
    }
    for (const led of ledViews) {
      led.board.material.emissiveIntensity = active ? 0.75 + 0.3 * Math.sin(now * 0.022) : 0.32;
      led.label.material.opacity = active ? 0.8 + 0.2 * Math.sin(now * 0.018) : 1;
    }
    for (const net of goalNetViews) {
      const impact = active ? Math.sin(now * 0.022) * 0.12 : 0;
      net.scale.x = 1 + Math.abs(impact);
      net.material.opacity = 0.34 + Math.abs(impact) * 2;
    }
  }

  function render(frame) {
    if (!renderer || !scene || !camera) return false;
    updateAtmosphere(frame);
    updateCelebration(frame);
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
    for (const object of foreignObjects) attempt(() => scene?.remove?.(object));
    attempt(() => scene?.remove?.(environmentRoot));
    if (scene) scene.environment = null;
    attempt(() => disposeObject(environmentRoot));
    attempt(() => safeDispose(environmentTexture));
    attempt(() => composer?.dispose?.());
    attempt(() => renderer?.dispose?.());
    attempt(() => renderer?.forceContextLoss?.());
    foreignObjects.clear();
    renderer = null;
    composer = null;
    scene = null;
    environmentRoot = null;
    camera = null;
    pitch = null;
    grass = null;
    crowd = null;
    rain = null;
    hemisphere = null;
    flood = null;
    rim = null;
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
      foreignObjects.add(object);
      return true;
    },
    removeObject: (object) => {
      if (!scene || !object) return false;
      scene.remove(object);
      foreignObjects.delete(object);
      return true;
    },
    setCameraPose: (pose) => {
      if (!camera) return false;
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
      lastCameraPose = Object.freeze({
        position: Object.freeze({ ...pose.position }),
        lookAt: Object.freeze({ ...pose.lookAt }),
      });
      return true;
    },
    copyCameraQuaternion: (destination) => {
      if (!camera || !destination?.copy) return false;
      destination.copy(camera.quaternion);
      return true;
    },
    requestRender: () => render(Object.freeze({
      snapshot: Object.freeze({
        match: Object.freeze({
          settings: Object.freeze({ pitchStyle: currentPitchStyle, weather: currentWeather }),
          replay: Object.freeze({ active: false }),
        }),
      }),
      nowMilliseconds: lastNow ?? 0,
    })),
    diagnostics: () => Object.freeze({
      owner: "clean-host",
      renderer: renderer ? "webgl" : "unavailable",
      composer: Boolean(composer),
      lowPowerDevice: Boolean(lowPowerDevice),
      profile: activeProfile.id,
      geometry: activeProfile.geometry,
      stadium: stadiumEnvelope(activeProfile),
      cameraPose: lastCameraPose,
      pitchCoverage: pitchViewportCoverage(camera, activeProfile),
      pitchStyle: currentPitchStyle,
      weather: currentWeather,
      sceneObjects: scene?.children?.length ?? 0,
      environmentObjects: environmentRoot?.children?.length ?? 0,
      foreignObjects: foreignObjects.size,
      maxAnisotropy: renderer?.capabilities?.getMaxAnisotropy?.() ?? 1,
    }),
  });

  return Object.freeze({ port, start, resize, render, reset, dispose });
}
