from pathlib import Path

path = Path("game.js")
text = path.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


def replace_span(start, end, replacement, label):
    global text
    start_index = text.find(start)
    end_index = text.find(end, start_index + len(start))
    if start_index < 0 or end_index < 0:
        raise RuntimeError(f"{label}: markers missing")
    if text.find(start, start_index + len(start)) >= 0:
        raise RuntimeError(f"{label}: start marker repeated")
    text = text[:start_index] + replacement + text[end_index:]


for import_line, label in [
    ('import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";\n', "EffectComposer import"),
    ('import { RenderPass } from "three/addons/postprocessing/RenderPass.js";\n', "RenderPass import"),
    ('import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";\n', "SSAOPass import"),
    ('import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";\n', "UnrealBloomPass import"),
    ('import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";\n', "SMAAPass import"),
    ('import { OutputPass } from "three/addons/postprocessing/OutputPass.js";\n', "OutputPass import"),
    ('import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";\n', "RoomEnvironment import"),
    ('import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";\n', "GLTFLoader import"),
    ('import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";\n', "SkeletonUtils import"),
    ('import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";\n', "Meshopt import"),
]:
    replace_once(import_line, "", label)

replace_span(
    "  const playerViews = new Map();",
    "  const PITCH_STYLES = {",
    '''  let threeScenePort = null;
  let ballTrailView; let particleView; let screenFx; let ctx; let use3D = true;
  const runtimeParams = new URLSearchParams(location.search);
  const visualTestMode = runtimeParams.get("visualTest") === "1";
  const rendererPreference = runtimeParams.get("renderer");
  const lowPowerDevice = visualTestMode || matchMedia("(pointer: coarse)").matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const cameraTarget = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3(0, lowPowerDevice ? 54 : 45, lowPowerDevice ? 63 : 52);

''',
    "presentation state",
)

replace_span(
    "  function createTeams() {",
    "  function resetMatch() {",
    '''  function createTeams() {
    players = [
      ...formations.home.map((spec, index) => new Player(HOME, spec, index)),
      ...formations.away.map((spec, index) => new Player(AWAY, spec, index))
    ];
    game.selected = players[4];
  }

''',
    "team model-view ownership",
)

replace_span(
    "  function init3D() {",
    "  function createPitchTexture3D() {",
    '''  function init3D() {
    if (rendererPreference === "canvas") {
      use3D = false;
      ctx = canvas.getContext("2d");
      return false;
    }
    threeScenePort = window.__TONY_THREE_SCENE_BRIDGE__?.getPort?.() ?? null;
    if (!threeScenePort) {
      use3D = false;
      ctx = canvas.getContext("2d");
      ui.commentary.textContent = "WebGL không khả dụng · Đang chạy chế độ tương thích 2D";
      return false;
    }
    use3D = true;
    ballTrailView = createBallTrail3D(THREE, { maxPoints: gameFeel.config.ball.trailMaxPoints });
    threeScenePort.addObject(ballTrailView.line);
    createParticleView();
    screenFx = canvas.parentElement.querySelector(".screen-fx") ?? document.createElement("div");
    if (!screenFx.classList.contains("screen-fx")) {
      screenFx.className = "screen-fx";
      screenFx.innerHTML = "<span>GOAL!</span>";
      canvas.parentElement.appendChild(screenFx);
    }
    return true;
  }

''',
    "clean host and model-view initialization",
)

replace_span(
    "  function createPitchTexture3D() {",
    "  function createLabelSprite(player, accent) {",
    "",
    "legacy environment construction",
)

replace_span(
    "  function createLabelSprite(player, accent) {",
    "  function createParticleView() {",
    '''  function applyPitchStyle() { return true; }

  function applyBallStyle() { return true; }

''',
    "player ball and model animation ownership",
)

text = text.replace("scene3D.add(particleView);", "threeScenePort?.addObject(particleView);")

replace_span(
    "  function createChargeView() {",
    "  function updateParticleView() {",
    "",
    "charge and player projection ownership",
)

replace_span(
    "  function updateAtmosphere3D(now) {",
    "  function drawFallbackPlayerDetail",
    '''  function render3D(now, snapshot, renderState) {
    if (!threeScenePort) return false;
    const replayFrame = currentReplayFrame();
    const renderBall = replayFrame?.ball || renderState.ball;
    const renderTrail = replayFrame?.ball.trail || snapshot.ball.trail;
    const visualSpeed = Math.hypot(renderBall.vx || 0, renderBall.vy || 0);
    ballTrailView?.update(renderTrail, {
      worldX,
      worldZ,
      speed: visualSpeed,
      opacityForIndex: (index, count, speed) => gameFeel.trailOpacity(index, count, speed),
    });
    updateParticleView();

    const cameraState = cameraController.state;
    const framedX = replayFrame ? renderBall.x : cameraState.x;
    const framedY = replayFrame ? renderBall.y : cameraState.y;
    const targetX = worldX(framedX);
    const targetZ = worldZ(framedY);
    const zoomScale = replayFrame ? 1 : 1 / Math.max(0.01, cameraState.zoom);
    if (replayFrame) {
      const scoringRight = game.goalSequence?.team === HOME;
      cameraTarget.set(targetX + (scoringRight ? -16 : 16), 13, clamp(targetZ + 22, -19, 19));
      cameraLook.set(targetX, 1.2, targetZ);
    } else if (game.goalSequence) {
      const scorer = game.goalScorer || ball;
      cameraTarget.set(worldX(scorer.x) - 9, 8.5, worldZ(scorer.y) + 12);
      cameraLook.set(worldX(scorer.x), 2.4, worldZ(scorer.y));
    } else if (game.cameraMode === "tactical") {
      cameraTarget.set(targetX, (lowPowerDevice ? 66 : 60) * zoomScale, 30 * zoomScale + targetZ * 0.04);
      cameraLook.set(targetX, 0, targetZ);
    } else if (game.cameraMode === "close") {
      cameraTarget.set(targetX - 11, (lowPowerDevice ? 26 : 20) * zoomScale, (lowPowerDevice ? 38 : 31) * zoomScale + targetZ * 0.14);
      cameraLook.set(targetX, 1.2, targetZ);
    } else {
      cameraTarget.set(targetX, (lowPowerDevice ? 54 : 47) * zoomScale, (lowPowerDevice ? 66 : 57) * zoomScale + targetZ * 0.06);
      cameraLook.set(targetX, 0.7, targetZ);
    }
    const cameraDt = Math.min(0.05, Math.max(0, (render3D.lastNow ? now - render3D.lastNow : 16.667) / 1000));
    render3D.lastNow = now;
    cameraPosition.lerp(cameraTarget, gameFeel.cameraEase(cameraDt, Boolean(replayFrame)));
    const feelOffset = gameFeel.sampleCameraOffset(now);
    cameraPosition.x += feelOffset.x * 0.42 + feelOffset.z * 0.12;
    cameraPosition.y += feelOffset.y * 0.28;
    cameraPosition.z += feelOffset.z * 0.28;
    threeScenePort.setCameraPose(Object.freeze({
      position: Object.freeze({ x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z }),
      lookAt: Object.freeze({ x: cameraLook.x, y: cameraLook.y, z: cameraLook.z }),
    }));

    screenFx.style.opacity = String(clamp(game.flash, 0, 1));
    screenFx.classList.toggle("active", game.flash > 0.02);
    return true;
  }

  function drawFallbackPlayerDetail''',
    "snapshot model-view and clean-host render projection",
)

replace_once(
    "    createPresentationFeedback,\n  });",
    "    createPresentationFeedback,\n    onPresentationReady: init3D,\n  });",
    "presentation-ready hook",
)

replace_once(
    '      renderer: use3D ? "webgl" : "canvas",\n',
    '      renderer: use3D ? "webgl" : "canvas",\n      threeScene: window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "canvas-fallback", renderer: "canvas", profile: null }),\n      modelViews: window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "canvas-fallback", playerCount: 0, ballReady: false }),\n',
    "diagnostics",
)

replace_once(
    "  init3D(); createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();",
    "  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();",
    "boot order",
)

for forbidden in [
    "new THREE.WebGLRenderer",
    "new EffectComposer",
    "new RoomEnvironment",
    "scene3D",
    "renderer3D",
    "composer3D",
    "camera3D",
    "createPitch3D",
    "createGrass3D",
    "createStadium3D",
    "createAtmosphere3D",
    "createGoals3D",
    "GLTFLoader",
    "cloneSkeleton",
    "MeshoptDecoder",
    "playerViews",
    "playerAsset",
    "createPlayerView",
    "upgradePlayerView",
    "new THREE.AnimationMixer",
    "createBall3D",
    "ballView",
    "chargeView",
    "createChargeView",
    "updatePlayerView",
    "updateRigPlayer",
    "applyIntegratedFootballKit",
    "createBallSurfaceTextures",
]:
    if forbidden in text:
        raise RuntimeError(f"extracted presentation ownership remains: {forbidden}")

path.write_text(text, encoding="utf-8")
