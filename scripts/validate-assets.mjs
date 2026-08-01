import { readFile } from "node:fs/promises";

const MAGIC = 0x46546c67;
async function readGLB(path) { const bytes = await readFile(path); if (bytes.readUInt32LE(0) !== MAGIC) throw new Error(`${path}: invalid GLB magic`); if (bytes.readUInt32LE(4) !== 2) throw new Error(`${path}: expected glTF 2.0`); if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`${path}: declared length does not match file size`); const jsonLength = bytes.readUInt32LE(12); const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0/g, "")); return { bytes, json }; }
const characterPath = "assets/models/football-character-v2.glb"; const animationPath = "assets/models/football-animations-v2.glb";
const character = await readGLB(characterPath); const animation = await readGLB(animationPath);
const scaleProfileSource = await readFile("src/game/config/simulationScaleProfile.js", "utf8");
const playerSource = await readFile("src/game/presentation/PlayerModelView.js", "utf8");
const adapterSource = await readFile("src/game/presentation/BrowserModelViewAdapter.js", "utf8");
const loaderSource = await readFile("src/game/presentation/PlayerAssetLoader.js", "utf8");
const ballSource = await readFile("src/game/presentation/BallModelView.js", "utf8");
const canvasSource = await readFile("src/game/presentation/CanvasMatchRenderer.js", "utf8");
const cameraReplaySource = await readFile("src/game/presentation/SnapshotCameraReplayAdapter.js", "utf8");
const settingsSource = await readFile("src/game/presentation/BrowserSettingsAdapter.js", "utf8");
const effectsSource = await readFile("src/game/presentation/BrowserEffectsAdapter.js", "utf8");
const gameSource = await readFile("game.js", "utf8");
const entrySource = await readFile("browser-entry.js", "utf8"); const indexSource = await readFile("index.html", "utf8");
if (character.bytes.length > 750_000) throw new Error(`${characterPath}: exceeds 750 KB budget`); if (animation.bytes.length > 750_000) throw new Error(`${animationPath}: exceeds 750 KB budget`);
const unsupportedCharacterExtensions = (character.json.extensionsRequired || []).filter((extension) => extension !== "KHR_mesh_quantization"); if (unsupportedCharacterExtensions.length) throw new Error(`${characterPath}: unsupported required extensions: ${unsupportedCharacterExtensions.join(", ")}`);
if (!character.json.images?.every((image) => ["image/jpeg", "image/png"].includes(image.mimeType))) throw new Error(`${characterPath}: textures must have JPEG or PNG fallback`);
const characterNodes = new Set((character.json.nodes || []).map((node) => node.name).filter(Boolean));
const expectedKitBones = ["Head", "spine_01", "spine_02", "spine_03", "pelvis", "upperarm_l", "upperarm_r", "thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "hand_l", "hand_r", "SuperHero_Male"];
const missingKitBones = expectedKitBones.filter((name) => !characterNodes.has(name)); if (missingKitBones.length) throw new Error(`${characterPath}: missing football kit targets: ${missingKitBones.join(", ")}`);
const bodyNode = character.json.nodes.find((node) => node.name === "SuperHero_Male"); const bodyPrimitive = character.json.meshes?.[bodyNode?.mesh]?.primitives?.[0]; const bodyPosition = character.json.accessors?.[bodyPrimitive?.attributes?.POSITION]; if (!bodyPosition || bodyPosition.componentType !== 5122 || !bodyPosition.normalized || bodyPosition.count < 7000) throw new Error(`${characterPath}: integrated kit requires the normalized high-detail body position stream`);
const animationTargets = new Set(); for (const clip of animation.json.animations || []) for (const channel of clip.channels || []) animationTargets.add(animation.json.nodes[channel.target.node]?.name); const missingTargets = [...animationTargets].filter((name) => !characterNodes.has(name)); if (missingTargets.length) throw new Error(`${animationPath}: missing character targets: ${missingTargets.join(", ")}`);
const expectedClips = ["Idle_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Hit_Chest", "Roll", "Dance_Loop"]; const clipNames = new Set((animation.json.animations || []).map((clip) => clip.name)); const missingClips = expectedClips.filter((clip) => !clipNames.has(clip)); if (missingClips.length) throw new Error(`${animationPath}: missing clips: ${missingClips.join(", ")}`); if (!animation.json.extensionsRequired?.includes("EXT_meshopt_compression")) throw new Error(`${animationPath}: expected Meshopt-compressed animation data`);
for (const [sourceName, source, contracts] of [
  ["simulationScaleProfile.js", scaleProfileSource, ["mini-6v6-metric-v1", "unitsPerMetre: 20", "representativeHeightMetres: 1.8", "radiusMetres: 0.11", "deepFreeze"]],
  ["PlayerAssetLoader.js", loaderSource, ["loader.setMeshoptDecoder(MeshoptDecoder)", "football-character-v2.glb?v=16.0.0", "football-animations-v2.glb?v=16.0.0"]],
  ["BrowserModelViewAdapter.js", adapterSource, ["DEFAULT_SIMULATION_SCALE_PROFILE", "worldUnitsPerSimulationUnit", "profileId", "createSnapshotRenderState", "createDefaultPlayerAssetLoader", "disposePlayerAssetTemplate", "appearanceDiagnostics(playerViews)", "bootlessPlayers", "preservedMapPlayers"]],
  ["PlayerModelView.js", playerSource, ["new THREE.AnimationMixer(model)", "measureAndNormalizeRig", "representativeRigScale", "tonyScaleProfileId", "projectedHeight", "createSemanticPlayerMaterial", "classifyPlayerSurface", "tonySourceMapPreserved", "tonySharedTextures", "TonyBootLeft", "TonyBootRight", "applyFootballActionPose", "selectPlayerAnimationState"]],
  ["BallModelView.js", ballSource, ["new THREE.SphereGeometry(BALL_RADIUS, 48, 32)", "DEFAULT_SIMULATION_SCALE_PROFILE", "createBallSurfaceTextures", "chargeRoot"]],
  ["CanvasMatchRenderer.js", canvasSource, ["DEFAULT_SIMULATION_SCALE_PROFILE", "createSnapshotRenderState", "CanvasMatchRenderer requires an immutable frame", "canvas-match-renderer"]],
  ["SnapshotCameraReplayAdapter.js", cameraReplaySource, ["snapshot-camera-replay", "snapshot.match.replay", "match: current.match", "goalIncidentKey(snapshot)", "recordIncident(snapshot, key)", "playbackIncidentKey", "update() { return false; }"]],
  ["BrowserSettingsAdapter.js", settingsSource, ["user-preference", "browser settings owner already attached", "controlBindings", "previewCount"]],
  ["BrowserEffectsAdapter.js", effectsSource, ["browser effects owner already attached", "emitContextParticles", "projectTrail", "projectCharge", "projectionSequence"]],
]) for (const contract of contracts) if (!source.includes(contract)) throw new Error(`${sourceName}: missing presentation contract: ${contract}`);
if (playerSource.includes("material.map = null")) throw new Error("PlayerModelView.js: semantic source texture maps must not be cleared");
for (const contract of ["DEFAULT_SIMULATION_SCALE_PROFILE", "SCALE_PROFILE.field.bounds", "SCALE_PROFILE.simulation.worldUnitsPerSimulationUnit"]) if (!gameSource.includes(contract)) throw new Error(`game.js: missing world-scale contract ${contract}`);
if (gameSource.includes("const WORLD_SCALE = .1")) throw new Error("game.js: legacy WORLD_SCALE remains");
if (adapterSource.includes("scale = 0.1")) throw new Error("BrowserModelViewAdapter.js: legacy projection scale remains");
for (const pageContract of ["src/styles/app.css", "browser-entry.js?v=1.0.0", "class=\"match-hud\"", "class=\"overlay-card pre-match-card\"", "class=\"overlay-card pause-card\""]) if (!indexSource.includes(pageContract)) throw new Error(`index.html: missing match experience contract: ${pageContract}`);
if (!entrySource.includes('await import("./generated/game.js?v=24.0.0")')) throw new Error("browser-entry.js: missing corrected TON-83 generated game entry import");
for (const contract of ["createBrowserModelViewAdapter", "createCanvasMatchRenderer", "createSnapshotCameraReplayAdapter", "__TONY_CAMERA_REPLAY_BRIDGE__", "cameraReplay: projection", "cameraReplayConsumer: owner", "createBrowserSettingsAdapter", "createBrowserEffectsAdapter", "__TONY_SETTINGS_EFFECTS_BRIDGE__"]) if (!entrySource.includes(contract)) throw new Error(`browser-entry.js: missing presentation contract ${contract}`);
console.log(`Player assets and presentation contracts valid: character ${(character.bytes.length / 1024).toFixed(0)} KB, animations ${(animation.bytes.length / 1024).toFixed(0)} KB, ${clipNames.size} clips.`);
