import { readFile } from "node:fs/promises";

const MAGIC = 0x46546c67;

async function readGLB(path) {
  const bytes = await readFile(path);
  if (bytes.readUInt32LE(0) !== MAGIC) throw new Error(`${path}: invalid GLB magic`);
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${path}: expected glTF 2.0`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`${path}: declared length does not match file size`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0/g, ""));
  return { bytes, json };
}

const characterPath = "assets/models/football-character-v2.glb";
const animationPath = "assets/models/football-animations-v2.glb";
const character = await readGLB(characterPath);
const animation = await readGLB(animationPath);
const gameSource = await readFile("game.js", "utf8");
const indexSource = await readFile("index.html", "utf8");

if (character.bytes.length > 750_000) throw new Error(`${characterPath}: exceeds 750 KB budget`);
if (animation.bytes.length > 750_000) throw new Error(`${animationPath}: exceeds 750 KB budget`);
const unsupportedCharacterExtensions = (character.json.extensionsRequired || []).filter((extension) => extension !== "KHR_mesh_quantization");
if (unsupportedCharacterExtensions.length) throw new Error(`${characterPath}: unsupported required extensions: ${unsupportedCharacterExtensions.join(", ")}`);
if (!character.json.images?.every((image) => ["image/jpeg", "image/png"].includes(image.mimeType))) {
  throw new Error(`${characterPath}: textures must have JPEG or PNG fallback`);
}

const characterNodes = new Set((character.json.nodes || []).map((node) => node.name).filter(Boolean));
const expectedKitBones = ["Head", "spine_01", "spine_02", "spine_03", "pelvis", "upperarm_l", "upperarm_r", "thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "hand_l", "hand_r", "SuperHero_Male"];
const missingKitBones = expectedKitBones.filter((name) => !characterNodes.has(name));
if (missingKitBones.length) throw new Error(`${characterPath}: missing football kit targets: ${missingKitBones.join(", ")}`);
const bodyNode = character.json.nodes.find((node) => node.name === "SuperHero_Male");
const bodyPrimitive = character.json.meshes?.[bodyNode?.mesh]?.primitives?.[0];
const bodyPosition = character.json.accessors?.[bodyPrimitive?.attributes?.POSITION];
if (!bodyPosition || bodyPosition.componentType !== 5122 || !bodyPosition.normalized || bodyPosition.count < 7000) {
  throw new Error(`${characterPath}: integrated kit requires the normalized high-detail body position stream`);
}
const animationTargets = new Set();
for (const clip of animation.json.animations || []) {
  for (const channel of clip.channels || []) animationTargets.add(animation.json.nodes[channel.target.node]?.name);
}
const missingTargets = [...animationTargets].filter((name) => !characterNodes.has(name));
if (missingTargets.length) throw new Error(`${animationPath}: missing character targets: ${missingTargets.join(", ")}`);

const expectedClips = ["Idle_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Hit_Chest", "Roll", "Dance_Loop"];
const clipNames = new Set((animation.json.animations || []).map((clip) => clip.name));
const missingClips = expectedClips.filter((clip) => !clipNames.has(clip));
if (missingClips.length) throw new Error(`${animationPath}: missing clips: ${missingClips.join(", ")}`);
if (!animation.json.extensionsRequired?.includes("EXT_meshopt_compression")) {
  throw new Error(`${animationPath}: expected Meshopt-compressed animation data`);
}

for (const contract of [
  "loader.setMeshoptDecoder(MeshoptDecoder)",
  "football-character-v2.glb?v=16.0.0",
  "football-animations-v2.glb?v=16.0.0",
  "installPlayerAnimations(motion.animations||[])",
  "applyFootballActionPose(rig,pose,actionProgress,dt)",
  "createRigSquadNumber(player,home&&!keeper",
  "createIntegratedKitMaterial(source,player,palette,skinColor)",
  "applyIntegratedFootballKit(model,player)",
  "createBallSurfaceTextures(style)",
  "new THREE.SphereGeometry(.56,48,32)",
  "WEBGL · 2D FALLBACK"
]) {
  if (!gameSource.includes(contract)) throw new Error(`game.js: missing player loader contract: ${contract}`);
}
for (const legacyPrimitive of ["attach(\"spine_01\"", "patchGeometry", "new THREE.SphereGeometry(.82,20,16)"]) {
  if (gameSource.includes(legacyPrimitive)) throw new Error(`game.js: legacy primitive player/ball rendering returned: ${legacyPrimitive}`);
}

for (const pageContract of [
  "u1-match-experience.css",
  "game.js?v=20.0.0",
  "class=\"match-hud\"",
  "class=\"overlay-card pre-match-card\"",
  "class=\"overlay-card pause-card\""
]) {
  if (!indexSource.includes(pageContract)) throw new Error(`index.html: missing U1 match experience contract: ${pageContract}`);
}

console.log(`Player assets and U1 page contract valid: character ${(character.bytes.length / 1024).toFixed(0)} KB, animations ${(animation.bytes.length / 1024).toFixed(0)} KB, ${clipNames.size} clips.`);
