from pathlib import Path

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

player_path = Path("src/game/presentation/PlayerModelView.js")
player = player_path.read_text()
player = replace_once(
    player,
    'import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";\n',
    'import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";\nimport {\n  DEFAULT_SIMULATION_SCALE_PROFILE,\n  representativeRigScale,\n} from "../config/simulationScaleProfile.js";\n',
    "PlayerModelView import",
)
player = replace_once(
    player,
    'const SURFACES = Object.freeze(["kit", "shorts", "socks", "boots", "skin", "hair", "unknown"]);\n',
    'const SURFACES = Object.freeze(["kit", "shorts", "socks", "boots", "skin", "hair", "unknown"]);\nconst PLAYER_HEIGHT = DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits;\nconst PLAYER_RADIUS = DEFAULT_SIMULATION_SCALE_PROFILE.player.collisionRadiusMetres;\nconst PROCEDURAL_SOURCE_HEIGHT = 6.61;\nconst PROCEDURAL_SCALE = PLAYER_HEIGHT / PROCEDURAL_SOURCE_HEIGHT;\n',
    "PlayerModelView constants",
)
player = replace_once(
    player,
    '  const sprite = new THREE.Sprite(material); sprite.scale.set(5.2, 1.3, 1); sprite.position.y = 7; return sprite;',
    '  const sprite = new THREE.Sprite(material); sprite.scale.set(1.65, .42, 1); sprite.position.y = PLAYER_HEIGHT + .34; return sprite;',
    "PlayerModelView label scale",
)
player = replace_once(
    player,
    '  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.7, .09, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: .92, toneMapped: false })); marker.rotation.x = Math.PI / 2; marker.position.y = .08; root.add(marker);',
    '  body.scale.setScalar(PROCEDURAL_SCALE); body.position.y = .09;\n  const marker = new THREE.Mesh(new THREE.TorusGeometry(PLAYER_RADIUS * 1.22, .025, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: .92, toneMapped: false })); marker.rotation.x = Math.PI / 2; marker.position.y = .025; root.add(marker);',
    "PlayerModelView procedural scale",
)
measure = '''function measureAndNormalizeRig({ THREE, model, scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE }) {
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld?.(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const measuredHeight = Number(size.y);
  const scale = representativeRigScale(measuredHeight, scaleProfile);
  model.scale.setScalar(scale);
  model.updateMatrixWorld?.(true);
  model.userData.tonyScaleProfileId = scaleProfile.id;
  model.userData.tonyMeasuredRigHeight = measuredHeight;
  model.userData.tonyRepresentativeHeight = scaleProfile.player.representativeHeightWorldUnits;
  model.userData.tonyRigScale = scale;
  return Object.freeze({ measuredHeight, targetHeight: scaleProfile.player.representativeHeightWorldUnits, scale });
}
'''.replace('          ', '')
player = replace_once(
    player,
    'function prepareRigCandidate({ THREE, cloneModel, player, characterScene, animations }) {',
    measure + 'function prepareRigCandidate({ THREE, cloneModel, player, characterScene, animations }) {',
    "PlayerModelView measurement hook",
)
player = replace_once(
    player,
    '    model = cloneModel(characterScene); model.scale.set(2.96, 3.28, 2.96); model.rotation.y = 0;',
    '    model = cloneModel(characterScene); measureAndNormalizeRig({ THREE, model }); model.rotation.y = 0;',
    "PlayerModelView rig normalization",
)
player_path.write_text(player)

ball_path = Path("src/game/presentation/BallModelView.js")
ball = ball_path.read_text()
ball = replace_once(
    ball,
    'import * as THREE_NAMESPACE from "three";\n',
    'import * as THREE_NAMESPACE from "three";\nimport { DEFAULT_SIMULATION_SCALE_PROFILE } from "../config/simulationScaleProfile.js";\n\nconst BALL_RADIUS = DEFAULT_SIMULATION_SCALE_PROFILE.ball.radiusWorldUnits;\nconst CHARGE_HEIGHT = DEFAULT_SIMULATION_SCALE_PROFILE.player.representativeHeightWorldUnits + .55;\n',
    "BallModelView import",
)
ball = replace_once(ball, 'new THREE.SphereGeometry(0.56, 48, 32)', 'new THREE.SphereGeometry(BALL_RADIUS, 48, 32)', "BallModelView radius")
ball = replace_once(ball, 'new THREE.BoxGeometry(5, .22, .28)', 'new THREE.BoxGeometry(1.2, .06, .08)', "BallModelView charge background")
ball = replace_once(ball, 'new THREE.BoxGeometry(4.8, .24, .3)', 'new THREE.BoxGeometry(1.16, .065, .085)', "BallModelView charge fill")
ball = replace_once(ball, 'root.position.set(worldX(ball.x), .58 + (ball.height || 0), worldZ(ball.y))', 'root.position.set(worldX(ball.x), BALL_RADIUS + (ball.height || 0), worldZ(ball.y))', "BallModelView vertical position")
ball = replace_once(ball, 'chargeRoot.position.set(worldX(selectedPlayer.x), 7.5, worldZ(selectedPlayer.y))', 'chargeRoot.position.set(worldX(selectedPlayer.x), CHARGE_HEIGHT, worldZ(selectedPlayer.y))', "BallModelView charge height")
ball = replace_once(ball, 'fill.position.x = -2.4 + 2.4 * power', 'fill.position.x = -.58 + .58 * power', "BallModelView charge fill position")
ball_path.write_text(ball)

validator_path = Path("scripts/validate-assets.mjs")
validator = validator_path.read_text()
validator = replace_once(
    validator,
    'const playerSource = await readFile("src/game/presentation/PlayerModelView.js", "utf8");\n',
    'const scaleProfileSource = await readFile("src/game/config/simulationScaleProfile.js", "utf8");\nconst playerSource = await readFile("src/game/presentation/PlayerModelView.js", "utf8");\n',
    "validator scale source",
)
validator = replace_once(
    validator,
    '  ["PlayerAssetLoader.js", loaderSource, ["loader.setMeshoptDecoder(MeshoptDecoder)", "football-character-v2.glb?v=16.0.0", "football-animations-v2.glb?v=16.0.0"]],\n',
    '  ["simulationScaleProfile.js", scaleProfileSource, ["mini-6v6-metric-v1", "unitsPerMetre: 20", "representativeHeightMetres: 1.8", "radiusMetres: 0.11", "deepFreeze"]],\n  ["PlayerAssetLoader.js", loaderSource, ["loader.setMeshoptDecoder(MeshoptDecoder)", "football-character-v2.glb?v=16.0.0", "football-animations-v2.glb?v=16.0.0"]],\n',
    "validator profile contract",
)
validator = replace_once(
    validator,
    '["PlayerModelView.js", playerSource, ["new THREE.AnimationMixer(model)", "createSemanticPlayerMaterial", "classifyPlayerSurface", "tonySourceMapPreserved", "tonySharedTextures", "TonyBootLeft", "TonyBootRight", "applyFootballActionPose", "selectPlayerAnimationState"]]',
    '["PlayerModelView.js", playerSource, ["new THREE.AnimationMixer(model)", "measureAndNormalizeRig", "representativeRigScale", "tonyScaleProfileId", "createSemanticPlayerMaterial", "classifyPlayerSurface", "tonySourceMapPreserved", "tonySharedTextures", "TonyBootLeft", "TonyBootRight", "applyFootballActionPose", "selectPlayerAnimationState"]]',
    "validator player scale contract",
)
validator = replace_once(
    validator,
    '["BallModelView.js", ballSource, ["new THREE.SphereGeometry(0.56, 48, 32)", "createBallSurfaceTextures", "chargeRoot"]]',
    '["BallModelView.js", ballSource, ["new THREE.SphereGeometry(BALL_RADIUS, 48, 32)", "DEFAULT_SIMULATION_SCALE_PROFILE", "createBallSurfaceTextures", "chargeRoot"]]',
    "validator ball scale contract",
)
validator = replace_once(
    validator,
    '["CanvasMatchRenderer.js", canvasSource, ["createSnapshotRenderState", "CanvasMatchRenderer requires an immutable frame", "canvas-match-renderer"]]',
    '["CanvasMatchRenderer.js", canvasSource, ["DEFAULT_SIMULATION_SCALE_PROFILE", "createSnapshotRenderState", "CanvasMatchRenderer requires an immutable frame", "canvas-match-renderer"]]',
    "validator Canvas scale contract",
)
validator_path.write_text(validator)
