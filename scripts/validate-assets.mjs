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

if (character.bytes.length > 750_000) throw new Error(`${characterPath}: exceeds 750 KB budget`);
if (animation.bytes.length > 750_000) throw new Error(`${animationPath}: exceeds 750 KB budget`);
const unsupportedCharacterExtensions = (character.json.extensionsRequired || []).filter((extension) => extension !== "KHR_mesh_quantization");
if (unsupportedCharacterExtensions.length) throw new Error(`${characterPath}: unsupported required extensions: ${unsupportedCharacterExtensions.join(", ")}`);
if (!character.json.images?.every((image) => ["image/jpeg", "image/png"].includes(image.mimeType))) {
  throw new Error(`${characterPath}: textures must have JPEG or PNG fallback`);
}

const characterNodes = new Set((character.json.nodes || []).map((node) => node.name).filter(Boolean));
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
  "installPlayerAnimations(motion.animations||[])"
]) {
  if (!gameSource.includes(contract)) throw new Error(`game.js: missing player loader contract: ${contract}`);
}

console.log(`Player assets valid: character ${(character.bytes.length / 1024).toFixed(0)} KB, animations ${(animation.bytes.length / 1024).toFixed(0)} KB, ${clipNames.size} clips.`);
