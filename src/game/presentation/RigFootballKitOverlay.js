import * as THREE_NAMESPACE from "three";

const OVERLAY_MARKER = "TonyRigFootballKitOverlay";
const OVERLAY_FLAG = "tonyRigKitOverlay";
const BOOT_FLAG = "tonyRigBootGeometry";

function colorsFor(player) {
  const home = Number(player?.team ?? 0) === 0;
  const keeper = player?.role === "GK";
  return Object.freeze({
    jersey: keeper ? (home ? 0x7650d6 : 0xe65348) : (home ? 0xe1bb58 : 0x32b8c8),
    shorts: keeper ? 0x20212c : (home ? 0x171b1a : 0x092e35),
    socks: home ? 0xe9d58f : 0xb8eff3,
    boots: keeper ? 0x18191f : 0x101312,
    accent: home ? 0x151a18 : 0xe8fbfb,
  });
}

function standardMaterial(THREE, color, options = {}) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? .62, metalness: options.metalness ?? .02 });
  material.name = options.name ?? "TonyRigKitMaterial";
  material.userData.tonyOwnedRigKitMaterial = true;
  return material;
}

function markMesh(mesh, semantic, { boot = false } = {}) {
  mesh.userData[OVERLAY_FLAG] = true;
  mesh.userData.tonyAppearanceSemantic = semantic;
  if (boot) mesh.userData[BOOT_FLAG] = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function attachMesh({ root, boneName, mesh, position, rotation = [0, 0, 0] }) {
  const bone = root.getObjectByName?.(boneName) ?? null;
  if (!bone) throw new Error(`football kit overlay requires bone ${boneName}`);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  bone.add(mesh);
  return mesh;
}

function disposeCreated(meshes) {
  for (const mesh of meshes) {
    try { mesh.parent?.remove?.(mesh); } catch {}
    try { mesh.geometry?.dispose?.(); } catch {}
    try { mesh.material?.dispose?.(); } catch {}
  }
}

export function rigFootballKitEvidence(root) {
  let visibleKitNodeCount = 0;
  let bootGeometryCount = 0;
  const nodes = [];
  root?.traverse?.((node) => {
    if (!node.isMesh || !node.userData?.[OVERLAY_FLAG]) return;
    visibleKitNodeCount += 1;
    if (node.userData?.[BOOT_FLAG]) bootGeometryCount += 1;
    nodes.push(Object.freeze({ name: node.name, semantic: node.userData.tonyAppearanceSemantic ?? "unknown", boot: Boolean(node.userData?.[BOOT_FLAG]) }));
  });
  return Object.freeze({
    installed: Boolean(root?.getObjectByName?.(OVERLAY_MARKER)),
    visibleKitNodeCount,
    bootGeometryCount,
    nodes: Object.freeze(nodes),
  });
}

export function ensureRigFootballKitOverlay({ root, player, three = THREE_NAMESPACE, lowPowerDevice = false } = {}) {
  if (!root || typeof root.getObjectByName !== "function" || typeof root.traverse !== "function") throw new TypeError("rig football kit overlay requires a player root");
  if (!player || typeof player !== "object") throw new TypeError("rig football kit overlay requires player facts");
  const existing = root.getObjectByName(OVERLAY_MARKER);
  if (existing) return rigFootballKitEvidence(root);

  const THREE = three;
  const palette = colorsFor(player);
  const created = [];
  try {
    const jersey = markMesh(new THREE.Mesh(
      new THREE.CylinderGeometry(.205, .235, .32, lowPowerDevice ? 8 : 12, 1, false),
      standardMaterial(THREE, palette.jersey, { name: "TonyRigJerseyMaterial", roughness: .54 }),
    ), "kit");
    jersey.name = "TonyRigJersey";
    jersey.scale.z = .78;
    created.push(attachMesh({ root, boneName: "spine_02", mesh: jersey, position: [0, .14, .005], rotation: [.02, 0, 0] }));

    const chestBand = markMesh(new THREE.Mesh(
      new THREE.BoxGeometry(.40, .055, .19, 1, 1, 1),
      standardMaterial(THREE, palette.accent, { name: "TonyRigJerseyBandMaterial", roughness: .58 }),
    ), "kit");
    chestBand.name = "TonyRigJerseyBand";
    created.push(attachMesh({ root, boneName: "spine_02", mesh: chestBand, position: [0, .17, -.105], rotation: [.02, 0, 0] }));

    const shorts = markMesh(new THREE.Mesh(
      new THREE.BoxGeometry(.39, .20, .24, 1, 1, 1),
      standardMaterial(THREE, palette.shorts, { name: "TonyRigShortsMaterial", roughness: .68 }),
    ), "shorts");
    shorts.name = "TonyRigShorts";
    created.push(attachMesh({ root, boneName: "pelvis", mesh: shorts, position: [0, -.055, .012], rotation: [.02, 0, 0] }));

    for (const side of ["l", "r"]) {
      const sock = markMesh(new THREE.Mesh(
        new THREE.CylinderGeometry(.064, .072, .25, lowPowerDevice ? 6 : 9, 1, false),
        standardMaterial(THREE, palette.socks, { name: `TonyRigSock${side.toUpperCase()}Material`, roughness: .78 }),
      ), "socks");
      sock.name = side === "l" ? "TonyRigSockLeft" : "TonyRigSockRight";
      created.push(attachMesh({ root, boneName: `calf_${side}`, mesh: sock, position: [0, .31, 0], rotation: [0, 0, 0] }));

      const boot = markMesh(new THREE.Mesh(
        new THREE.BoxGeometry(.145, .27, .105, 2, 2, 2),
        standardMaterial(THREE, palette.boots, { name: `TonyRigBoot${side.toUpperCase()}Material`, roughness: .46, metalness: .06 }),
      ), "boots", { boot: true });
      boot.name = side === "l" ? "TonyRigBootLeft" : "TonyRigBootRight";
      created.push(attachMesh({ root, boneName: `foot_${side}`, mesh: boot, position: [0, .13, .025], rotation: [0, 0, 0] }));
    }

    const marker = new THREE.Group();
    marker.name = OVERLAY_MARKER;
    marker.userData.tonyRigKitOverlayMarker = true;
    root.add(marker);
    const evidence = rigFootballKitEvidence(root);
    if (evidence.visibleKitNodeCount !== 7 || evidence.bootGeometryCount !== 2) throw new Error("football kit overlay installed incomplete geometry");
    return evidence;
  } catch (error) {
    disposeCreated(created);
    root.getObjectByName?.(OVERLAY_MARKER)?.removeFromParent?.();
    throw error;
  }
}
