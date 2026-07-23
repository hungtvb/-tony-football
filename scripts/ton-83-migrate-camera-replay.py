from pathlib import Path

path = Path("game.js")
text = path.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


replace_once('import { createSnapshotCameraController } from "./src/game/presentation/SnapshotCameraController.js";\n', '', 'camera controller import')
replace_once('import { createSnapshotReplayController } from "./src/game/presentation/SnapshotReplayController.js";\n', '', 'replay controller import')
replace_once(
    '''  const cameraController = createSnapshotCameraController({
    worldWidth: W,
    worldHeight: H,
    viewportWidth: W,
    viewportHeight: H,
    config: cameraHudConfig.camera
  });
  const replayController = createSnapshotReplayController();''',
    '''  const cameraReplayBridge = window.__TONY_CAMERA_REPLAY_BRIDGE__;
  if (!cameraReplayBridge) throw new Error("Snapshot camera/replay bridge is unavailable");
  const cameraController = cameraReplayBridge.camera;
  const replayController = cameraReplayBridge.replay;''',
    'camera/replay bridge binding',
)
replace_once('  let recordReplaySnapshot = false;\n', '', 'legacy replay record flag declaration')
replace_once('    resolvePlayerCollisions(); updateBall(dt); if (!game.goalSequence) recordReplaySnapshot = true;\n', '    resolvePlayerCollisions(); updateBall(dt);\n', 'legacy replay record flag assignment')
replace_once(
    '''  function updateLegacyReplay(dt) {
    if (game.replay.update(dt)) {
      ui.replayBadge.classList.remove("show");
      publishCompatibilityEvent(GameEventType.REPLAY_ENDED);
    }
  }''',
    '''  function updateLegacyReplay() {
    // Replay phase and progress are immutable engine snapshot facts.
    return false;
  }''',
    'legacy replay timer update',
)
replace_once(
    '''  function simulationStep(dt) {
    recordReplaySnapshot = false;
    if (compatibilitySnapshots.snapshot) cameraController.update(compatibilitySnapshots.snapshot, dt);
    compatibilityTick += 1;
    updatePresentation(dt);
    if (game.messageTimer > 0) game.messageTimer -= dt;
    const snapshot = captureCompatibilitySnapshot();
    if (recordReplaySnapshot) game.replay.record(snapshot, dt);
  }''',
    '''  function simulationStep(dt) {
    compatibilityTick += 1;
    updatePresentation(dt);
    if (game.messageTimer > 0) game.messageTimer -= dt;
    captureCompatibilitySnapshot();
  }''',
    'simulation camera/replay timing ownership',
)
replace_once(
    '''  function renderFrame(alpha, now) {
    const frame = compatibilitySnapshots.createRenderFrame(alpha);
    lastSnapshotRenderState = createSnapshotRenderState(frame);
    render(now, frame.current, lastSnapshotRenderState);
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
    updateUI(frame.current);
  }''',
    '''  function renderFrame(alpha, now) {
    const frame = compatibilitySnapshots.createRenderFrame(alpha);
    lastSnapshotRenderState = createSnapshotRenderState(frame);
    render(now, frame.current, lastSnapshotRenderState);
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
    updateUI(frame.current);
  }''',
    'render frame remains projection-free',
)
replace_once(
    '''    if (replayFrame) {
      const scoringRight = game.goalSequence?.team === HOME;
      cameraTarget.set(targetX + (scoringRight ? -16 : 16), 13, clamp(targetZ + 22, -19, 19));
      cameraLook.set(targetX, 1.2, targetZ);
    }''',
    '''    const replayScoringRight = game.replay.scoringRight;
    const replayCameraActive = Boolean(replayFrame) && game.replay.cinematicAvailable === true && typeof replayScoringRight === "boolean";
    if (replayCameraActive) {
      const scoringRight = replayScoringRight;
      cameraTarget.set(targetX + (scoringRight ? 18 : -18), 24, clamp(targetZ + 24, -26, 26));
      cameraLook.set(targetX + (scoringRight ? -24 : 24), 1.5, targetZ);
    }''',
    'replay incident framing',
)
replace_once(
    '''    const cameraDt = Math.min(0.05, Math.max(0, (render3D.lastNow ? now - render3D.lastNow : 16.667) / 1000));
    render3D.lastNow = now;
    cameraPosition.lerp(cameraTarget, gameFeel.cameraEase(cameraDt, Boolean(replayFrame)));
    const feelOffset = gameFeel.sampleCameraOffset(now);
    cameraPosition.x += feelOffset.x * 0.42 + feelOffset.z * 0.12;
    cameraPosition.y += feelOffset.y * 0.28;
    cameraPosition.z += feelOffset.z * 0.28;''',
    '''    const cameraDt = Math.min(0.05, Math.max(0, (render3D.lastNow ? now - render3D.lastNow : 16.667) / 1000));
    render3D.lastNow = now;
    const enteringReplayCamera = replayCameraActive && !render3D.replayCameraActive;
    render3D.replayCameraActive = replayCameraActive;
    if (enteringReplayCamera) cameraPosition.copy(cameraTarget);
    else cameraPosition.lerp(cameraTarget, gameFeel.cameraEase(cameraDt, replayCameraActive));
    const feelOffset = gameFeel.sampleCameraOffset(now);
    cameraPosition.x += feelOffset.x * 0.42 + feelOffset.z * 0.12;
    cameraPosition.y += feelOffset.y * 0.28;
    cameraPosition.z += feelOffset.z * 0.28;
    if (replayCameraActive) {
      cameraPosition.x = clamp(cameraPosition.x, -58, 58);
      cameraPosition.y = Math.max(12, cameraPosition.y);
      cameraPosition.z = clamp(cameraPosition.z, -32, 32);
    }''',
    'replay camera stadium clearance',
)
replace_once(
    '    createPresentationFeedback,\n',
    '''    createPresentationFeedback,
    getPresentationFrameFacts: () => Object.freeze({
      cameraMode: game.cameraMode,
      goalScorerId: game.goalScorer ? compatibilityPlayerId(game.goalScorer) : null,
    }),
  ''',
    'presentation frame facts',
)
replace_once('    game.replay.start(captureCompatibilitySnapshot());\n', '    // Engine snapshots exclusively activate and advance replay.\n', 'manual goal replay activation')
replace_once(
    '''      game.replay.loadFrames(Array.from({ length: 24 }, (_, index) => Object.freeze({
        ...baseSnapshot,
        ball: Object.freeze({ ...baseSnapshot.ball, x: 430 + index * 10, y: 350, height: 0, angle: 0, vx: 150, vy: 0, trail: Object.freeze([]) })
      })));''',
    '''      void baseSnapshot;
      // Debug scenarios cannot inject or activate presentation replay.''',
    'debug replay frame injection',
)
replace_once(
    '      camera: { ...cameraController.state },\n',
    '''      camera: { ...cameraController.state },
      cameraReplay: cameraReplayBridge.diagnostics(),
      replayCameraFraming: Object.freeze({
        active: Boolean(game.replay.active),
        cinematicActive: Boolean(render3D.replayCameraActive),
        cinematicAvailable: Boolean(game.replay.cinematicAvailable),
        scoringRight: game.replay.scoringRight,
        frameIndex: cameraReplayBridge.diagnostics().replay.frameIndex,
        missingFrame: cameraReplayBridge.diagnostics().replay.missingFrame,
        position: Object.freeze({ x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z }),
        target: Object.freeze({ x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z }),
        look: Object.freeze({ x: cameraLook.x, y: cameraLook.y, z: cameraLook.z }),
      }),
''',
    'camera/replay diagnostics',
)

forbidden_tokens = [
    'createSnapshotCameraController', 'createSnapshotReplayController', 'game.replay.update(',
    'game.replay.record(', 'game.replay.start(', 'game.replay.loadFrames(', 'game.replay.syncElapsed(',
    'recordReplaySnapshot', 'cameraController.update(compatibilitySnapshots.snapshot',
    'cameraReplayBridge.project(', 'const scoringRight = framedX >= W / 2',
]
remaining = []
for line_number, line in enumerate(text.splitlines(), start=1):
    for token in forbidden_tokens:
        if token in line:
            remaining.append(f"{token}@{line_number}: {line.strip()[:220]}")
if remaining:
    raise RuntimeError("forbidden camera/replay ownership remains:\n" + "\n".join(remaining))
if 'window.__TONY_CAMERA_REPLAY_BRIDGE__' not in text or 'getPresentationFrameFacts' not in text:
    raise RuntimeError("camera/replay bridge or immutable frame facts are missing")
if 'enteringReplayCamera' not in text or 'cameraPosition.z = clamp(cameraPosition.z, -32, 32)' not in text:
    raise RuntimeError("replay camera stadium clearance is missing")
if 'const replayScoringRight = game.replay.scoringRight;' not in text or 'const scoringRight = replayScoringRight;' not in text:
    raise RuntimeError("replay side must remain latched for the immutable incident")
if 'const replayCameraActive = Boolean(replayFrame) && game.replay.cinematicAvailable === true' not in text:
    raise RuntimeError("missing-history replay must fall back without activating cinematic camera")
if 'Replay incident side is unavailable' in text:
    raise RuntimeError("missing-history replay still throws instead of using current-frame fallback")
if 'scoringRight ? 18 : -18' not in text or 'scoringRight ? -24 : 24' not in text:
    raise RuntimeError("replay incident inward framing is missing")
if 'replayCameraFraming: Object.freeze({' not in text or 'cinematicActive: Boolean(render3D.replayCameraActive)' not in text:
    raise RuntimeError("multi-frame replay camera diagnostics are missing")

path.write_text(text, encoding="utf-8")
