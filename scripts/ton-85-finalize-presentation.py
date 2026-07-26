from pathlib import Path

path = Path("game.js")
text = path.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


def remove_function(name):
    global text
    marker = f"function {name}("
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"function {name}: marker not found")
    start = text.rfind("\n", 0, start) + 1
    brace = text.find("{", start)
    depth = 0
    quote = None
    escaped = False
    index = brace
    while index < len(text):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in ('"', "'", "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                while end < len(text) and text[end] in " \t\r\n":
                    end += 1
                text = text[:start] + text[end:]
                return
        index += 1
    raise RuntimeError(f"function {name}: unbalanced braces")


for line in (
    'import * as THREE from "three";\n',
    'import { createGameFeelController } from "./src/game/presentation/GameFeelController.js";\n',
    'import { createBallTrail3D } from "./src/game/presentation/BallTrail3D.js";\n',
    'import { createAudioFeedbackController } from "./src/game/presentation/AudioFeedbackController.js";\n',
    'import { createHudSnapshotProjection } from "./src/game/presentation/HudSnapshotProjection.js";\n',
    'import { renderRadarSnapshot } from "./src/game/presentation/RadarSnapshotRenderer.js";\n',
    'import { createSnapshotRenderState } from "./src/game/presentation/SnapshotRenderState.js";\n',
):
    text = text.replace(line, "")

replace_once(
    '  const canvas = document.querySelector("#gameCanvas");\n  const radar = document.querySelector("#radarCanvas");\n  const rctx = radar.getContext("2d");\n  const W = canvas.width;\n  const H = canvas.height;\n',
    '  const canvas = document.querySelector("#gameCanvas");\n  const W = canvas.width;\n  const H = canvas.height;\n',
    "canvas composition",
)
replace_once(
    '  let threeScenePort = null;\n  let ballTrailView; let particleView; let screenFx; let use3D = true;\n',
    '',
    "legacy view owners",
)
replace_once(
    '  const cameraTarget = new THREE.Vector3();\n  const cameraLook = new THREE.Vector3();\n  const cameraPosition = new THREE.Vector3(0, lowPowerDevice ? 54 : 45, lowPowerDevice ? 63 : 52);\n',
    '',
    "legacy camera vectors",
)
ui_start = text.find('  const ui = {')
ui_end = text.find('  };\n\n  const formations', ui_start)
if ui_start < 0 or ui_end < 0:
    raise RuntimeError("legacy UI mirror markers not found")
text = text[:ui_start] + '''  const ui = Object.freeze({
    start: $("startOverlay"), pause: $("pauseOverlay"), result: $("resultOverlay"),
    commentary: $("commentary"), replayBadge: $("replayBadge"), matchState: $("matchState"),
  });

''' + text[ui_end + len('  };\n\n'):]
replace_once(
    '  const settingsEffectsBridge = window.__TONY_SETTINGS_EFFECTS_BRIDGE__;\n  if (!settingsEffectsBridge) throw new Error("Browser settings/effects bridge is unavailable");\n',
    '  const presentationPort = window.__TONY_COMPATIBILITY_PRESENTATION_PORT__;\n  if (!presentationPort) throw new Error("Outward-only compatibility presentation port is unavailable");\n',
    "compatibility presentation port",
)
text = text.replace('  const cameraController = cameraReplayBridge.camera;\n', '')
text = text.replace('  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;\n', '')
text = text.replace('  const gameFeel = createGameFeelController({ lowPowerDevice, reducedMotion });\n', '')
text = text.replace('  const audioFeedback = createAudioFeedbackController();\n', '')
text = text.replace('  let lastSnapshotRenderState = null;\n', '')
text = text.replace('    shake: 0, flash: 0, messageTimer: 0, kickOffTimer: 0, lastTime: performance.now(), sound: true,', '    messageTimer: 0, kickOffTimer: 0, lastTime: performance.now(), sound: true,')
text = text.replace('    goalSequence: null, goalScorer: null, hud: { selectedKey: "", playerChangeTimer: null }, weather:', '    goalSequence: null, goalScorer: null, weather:')
text = text.replace('presentationPort.effects', 'presentationPort')
text = text.replace('settingsEffectsBridge.effects.reset()', 'presentationPort.resetEffects()')
text = text.replace('settingsEffectsBridge.effects.recordTrail', 'presentationPort.recordBallTrail')
text = text.replace('settingsEffectsBridge.effects.update', 'presentationPort.stepEffects')
text = text.replace('settingsEffectsBridge.effects.emitParticles', 'presentationPort.emitParticles')
text = text.replace('settingsEffectsBridge.effects.emitContextParticles', 'presentationPort.emitContextParticles')
text = text.replace('settingsEffectsBridge.settings.set(', 'presentationPort.setSetting(')
text = text.replace('settingsEffectsBridge.settings.configure(', 'presentationPort.configureSettings(')
text = text.replace('settingsEffectsBridge.diagnostics()', 'presentationPort.diagnostics()')

for snippet in (
    ' updateUI(captureCompatibilitySnapshot());',
    ' updateUI(captureCompatibilitySnapshot(), team);',
    'tone(520, .035, "sine", .025);',
    'tone(610,.035,"sine",.025);',
    'tone(460,.04,"sine",.018);',
    'tone(620,.05,"sine",.025);',
):
    text = text.replace(snippet, '')

text = text.replace(' const shotImpulse=gameFeel.shotImpulse(power); if(shotImpulse>0){gameFeel.addImpulse(shotImpulse,game.stats.shots[HOME]+game.stats.shots[AWAY]);game.flash=Math.max(game.flash,shotImpulse*.5);}', '')
text = text.replace(' gameFeel.addImpulse(gameFeel.config.feedback.tackleImpulse,player.index+game.stats.shots[0]*13);', '')
text = text.replace(' game.flash = 1; game.shake = 18; gameFeel.addImpulse(gameFeel.config.feedback.goalImpulse,game.score[0]*31+game.score[1]*47);', '')
text = text.replace(' game.flash = 0;', '')
text = text.replace(' gameFeel.update(dt); game.flash = gameFeel.decayFlash(game.flash,dt); game.shake *= Math.pow(.04, dt);', '')
text = text.replace('const goalDuration=reducedMotion?3.15:3.65;', 'const goalDuration=3.65;')

start = text.find('  function init3D()')
end = text.find('  function updateUI(', start)
if start < 0 or end < 0:
    raise RuntimeError("legacy WebGL block markers not found")
text = text[:start] + text[end:]
remove_function("updateUI")
remove_function("currentReplayFrame")
remove_function("worldX")
remove_function("worldZ")

audio_start = text.find('  let audioContext = null;')
feedback_start = text.find('  function createPresentationFeedback()', audio_start)
if audio_start < 0 or feedback_start < 0:
    raise RuntimeError("legacy audio markers not found")
text = text[:audio_start] + text[feedback_start:]
remove_function("createPresentationFeedback")
feedback = '''  function createPresentationFeedback() {
    return createBrowserPresentationFeedbackAdapter({
      target: window,
      getSnapshot: () => compatibilitySnapshots.snapshot,
      onParticles: (facts) => presentationPort.emitParticles(facts),
      onContextParticles: (facts) => presentationPort.emitContextParticles({ ...facts, weather: game.weather, pitchStyle: game.pitchStyle })
    });
  }

'''
insert_at = text.find('function simulationStep(')
line_start = text.rfind('\n', 0, insert_at) + 1
insert_at = line_start
text = text[:insert_at] + feedback + text[insert_at:]

old_render = '''  function renderFrame(alpha, now) {
    const frame = compatibilitySnapshots.createRenderFrame(alpha);
    lastSnapshotRenderState = createSnapshotRenderState(frame);
    render(now, frame.current, lastSnapshotRenderState);
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
    updateUI(frame.current);
  }
'''
new_render = '''  function renderFrame() {
    if (!game.replay.active && game.cameraNotice <= 0) ui.replayBadge.classList.remove("show");
  }
'''
replace_once(old_render, new_render, "presentation render handoff")
text = text.replace('    onPresentationReady: init3D,\n', '')
text = text.replace('    const scenarioSnapshot = captureCompatibilitySnapshot(); cameraController.update(scenarioSnapshot, 1 / 60); updateUI(scenarioSnapshot);', '    captureCompatibilitySnapshot();')
text = text.replace('      camera: { ...cameraController.state },\n', '')
text = text.replace('      renderer: use3D ? "webgl" : "canvas",\n', '      renderer: rendererPreference === "canvas" ? "canvas" : "webgl",\n')
text = text.replace('      threeScene: window.__TONY_THREE_SCENE_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "canvas-fallback", renderer: "canvas", profile: null }),\n', '')
text = text.replace('      modelViews: window.__TONY_MODEL_VIEW_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "browser-model-views", attached: false }),\n', '')
text = text.replace('      canvasMatch: window.__TONY_CANVAS_MATCH_BRIDGE__?.diagnostics?.() ?? Object.freeze({ owner: "canvas-match-renderer", attached: false, active: false }),\n', '')

render_state_start = text.find('      renderState: lastSnapshotRenderState ? {')
if render_state_start >= 0:
    render_state_end = text.find('      } : null,\n', render_state_start)
    if render_state_end < 0:
        raise RuntimeError("debug render state end not found")
    text = text[:render_state_start] + text[render_state_end + len('      } : null,\n'):]

text = text.replace('  createTeams(); updateUI(captureCompatibilitySnapshot()); browserBootstrap.start();', '  createTeams(); captureCompatibilitySnapshot(); browserBootstrap.start();')

for forbidden in (
    'createHudSnapshotProjection', 'renderRadarSnapshot', 'createSnapshotRenderState',
    'createAudioFeedbackController', 'createBallTrail3D', 'createGameFeelController',
    'function init3D(', 'function render3D(', 'function updateUI(', 'function tone(',
    '__TONY_THREE_SCENE_BRIDGE__', '__TONY_MODEL_VIEW_BRIDGE__', '__TONY_CANVAS_MATCH_BRIDGE__',
    '__TONY_SETTINGS_EFFECTS_BRIDGE__',
):
    if forbidden in text:
        raise RuntimeError(f"forbidden migrated owner remains: {forbidden}")

path.write_text(text, encoding="utf-8")
