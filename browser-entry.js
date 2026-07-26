import { cameraHudConfig } from "./src/game/config/cameraHudConfig.js";
import { createCanvasMatchRenderer } from "./src/game/presentation/CanvasMatchRenderer.js";
import { createBrowserModelViewAdapter } from "./src/game/presentation/BrowserModelViewAdapter.js";
import { createBrowserThreeSceneEnvironmentAdapter } from "./src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js";
import { createRebindableThreeSceneHostPort } from "./src/game/presentation/RebindableThreeSceneHostPort.js";
import { createSnapshotCameraReplayAdapter } from "./src/game/presentation/SnapshotCameraReplayAdapter.js";
import { createBrowserSettingsAdapter } from "./src/game/presentation/BrowserSettingsAdapter.js";
import { createBrowserEffectsAdapter } from "./src/game/presentation/BrowserEffectsAdapter.js";
import { createBrowserEffectsViewAdapter } from "./src/game/presentation/BrowserEffectsViewAdapter.js";
import { FO4_CONTROLS } from "./src/game/input/FO4Controls.js";

const BLOCKED_GAMEPLAY_PARAMS = Object.freeze(["runtime", "debugScenario"]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function sanitizeBrowserRuntimeSearch(search = "") {
  const params = new URLSearchParams(search); let changed = false;
  for (const name of BLOCKED_GAMEPLAY_PARAMS) { if (!params.has(name)) continue; params.delete(name); changed = true; }
  return { changed, search: params.size > 0 ? `?${params.toString()}` : "" };
}

export function removeBrowserGameplayDebugMutators(debug = null) {
  if (!debug || typeof debug !== "object") return false;
  const removed = Object.prototype.hasOwnProperty.call(debug, "applyScenario");
  if (removed) delete debug.applyScenario;
  return removed;
}

export function createReplayCameraFraming(projection = null) {
  if (!projection?.camera || !projection?.replay || !projection?.renderSnapshot?.ball) return null;
  const camera = projection.camera;
  const replay = projection.replay;
  const subject = projection.renderSnapshot.ball;
  const target = Object.freeze({ x: (Number(subject.x) - 600) * .1, y: .8, z: (Number(subject.y) - 350) * .1 });
  const cinematicActive = Boolean(replay.active && replay.cinematicAvailable);
  const scoringDirection = replay.scoringRight === true ? -1 : 1;
  const look = cinematicActive
    ? Object.freeze({ x: target.x + scoringDirection * 6, y: 1.2, z: target.z })
    : target;
  const position = cinematicActive
    ? Object.freeze({ x: clamp(look.x + scoringDirection * 18, -58, 58), y: 18, z: clamp(target.z + 14, -32, 32) })
    : Object.freeze({ x: clamp((Number(camera.x) - 600) * .1, -58, 58), y: Math.max(12, 45 / Math.max(.5, Number(camera.zoom) || 1)), z: clamp((Number(camera.y) - 350) * .1 + 28, -32, 32) });
  return Object.freeze({
    active: Boolean(replay.active),
    cinematicActive,
    cinematicAvailable: Boolean(replay.cinematicAvailable),
    scoringRight: replay.scoringRight ?? null,
    frameIndex: Number(replay.frameIndex ?? -1),
    target,
    look,
    position,
  });
}

export function exposeBrowserPresentationDiagnostics(debug, modelViewBridge, bridges = {}) {
  if (!debug || typeof debug !== "object" || !Object.isExtensible(debug)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(debug, "modelViews");
  const diagnosticsDescriptor = Object.getOwnPropertyDescriptor(debug, "diagnostics");
  if ((descriptor && descriptor.configurable === false) || (diagnosticsDescriptor && diagnosticsDescriptor.configurable === false)) return false;
  const baseDiagnostics = typeof debug.diagnostics === "function" ? debug.diagnostics.bind(debug) : () => Object.freeze({});
  Object.defineProperty(debug, "modelViews", { configurable: true, enumerable: true, get: () => modelViewBridge.diagnostics() });
  Object.defineProperty(debug, "diagnostics", {
    configurable: true,
    enumerable: true,
    value: () => Object.freeze({
      ...baseDiagnostics(),
      threeScene: bridges.threeScene?.diagnostics?.() ?? null,
      canvasMatch: bridges.canvasMatch?.diagnostics?.() ?? null,
      cameraReplay: bridges.cameraReplay?.diagnostics?.() ?? null,
      replayCameraFraming: createReplayCameraFraming(bridges.cameraReplay?.projection?.() ?? null),
      modelViews: modelViewBridge.diagnostics(),
    }),
  });
  return true;
}

function projectedPresentationFrame(frame, projection) {
  if (!projection) return frame;
  return Object.freeze({
    ...frame,
    snapshot: projection.renderSnapshot,
    previousSnapshot: projection.renderSnapshot,
    alpha: 1,
    cameraReplay: projection,
  });
}

function wrapProjectedAdapter(adapter, getProjection, owner, projectEffects = (frame) => frame) {
  let consumedProjectionSequence = 0;
  return Object.freeze({
    attach: (...args) => adapter.attach?.(...args),
    render(frame) {
      const projection = getProjection();
      if (projection?.projectionSequence) consumedProjectionSequence = projection.projectionSequence;
      return adapter.render?.(projectedPresentationFrame(projectEffects(frame), projection));
    },
    reset: (...args) => { consumedProjectionSequence = 0; return adapter.reset?.(...args); },
    teardown: (...args) => adapter.teardown?.(...args),
    diagnostics: () => Object.freeze({ ...(adapter.diagnostics?.() ?? {}), cameraReplayConsumer: owner, consumedProjectionSequence, camera: getProjection()?.camera ?? null, replay: getProjection()?.replay ?? null }),
  });
}

function wrapProjectedSceneAdapter(adapter, getProjection, getScenePort) {
  let consumedProjectionSequence = 0;
  return Object.freeze({
    attach: (...args) => adapter.attach?.(...args),
    render(frame) {
      const projection = getProjection();
      const framing = createReplayCameraFraming(projection);
      if (projection?.projectionSequence) consumedProjectionSequence = projection.projectionSequence;
      if (framing) getScenePort()?.setCameraPose?.({ position: framing.position, lookAt: framing.look });
      return adapter.render?.(projectedPresentationFrame(frame, projection));
    },
    reset: (...args) => { consumedProjectionSequence = 0; return adapter.reset?.(...args); },
    teardown: (...args) => adapter.teardown?.(...args),
    diagnostics: () => Object.freeze({ owner: "projected-three-scene", consumedProjectionSequence, replayCameraFraming: createReplayCameraFraming(getProjection()) }),
  });
}

if (typeof globalThis.window !== "undefined") {
  const sceneFacade = createRebindableThreeSceneHostPort();
  const cameraReplayAdapter = createSnapshotCameraReplayAdapter({ worldWidth: 1200, worldHeight: 700, viewportWidth: 1200, viewportHeight: 700, cameraConfig: cameraHudConfig.camera });
  const settingsAdapter = createBrowserSettingsAdapter({ target: globalThis.window, document: globalThis.document, controlBindings: FO4_CONTROLS });
  const effectsAdapter = createBrowserEffectsAdapter({ target: globalThis.window, lowPowerDevice: globalThis.navigator?.hardwareConcurrency <= 4, reducedMotion: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches });
  const e2ePresentationSeams = new URLSearchParams(globalThis.location.search).has("goalTest");
  let modelViewAdapter = null; let canvasMatchRenderer = null; let sceneAdapter = null;
  const sceneBridge = Object.freeze({ getPort: () => sceneFacade.bound ? sceneFacade.port : null, getStablePort: () => sceneFacade.port, diagnostics: () => Object.freeze({ ...sceneFacade.port.diagnostics(), projected: sceneAdapter?.diagnostics?.() ?? null }) });
  const cameraReplayBridge = Object.freeze({
    camera: cameraReplayAdapter.camera,
    replay: cameraReplayAdapter.replay,
    projection: () => cameraReplayAdapter.projection(),
    diagnostics: () => cameraReplayAdapter.diagnostics(),
    ...(e2ePresentationSeams ? { resetForE2E: () => cameraReplayAdapter.reset() } : {}),
  });
  const modelViewBridge = Object.freeze({ diagnostics: () => modelViewAdapter?.diagnostics?.() ?? Object.freeze({ owner: "browser-model-views", attached: false, playerCount: 0, ballAttached: false, assetState: "idle" }) });
  const canvasMatchBridge = Object.freeze({ diagnostics: () => canvasMatchRenderer?.diagnostics?.() ?? Object.freeze({ owner: "canvas-match-renderer", attached: false, active: false, status: "idle", renderCount: 0, lastFacts: null }) });
  const settingsEffectsBridge = Object.freeze({ settings: settingsAdapter, effects: effectsAdapter, diagnostics: () => Object.freeze({ settings: settingsAdapter.diagnostics(), effects: effectsAdapter.diagnostics() }) });
  const compatibilityPresentationPort = Object.freeze({
    configureSettings: (configuration) => settingsAdapter.configure(Object.freeze({ ...configuration })),
    setSetting: (name, value) => settingsAdapter.set(name, value),
    resetEffects: () => effectsAdapter.reset(),
    stepEffects: (dt) => effectsAdapter.update(dt),
    recordBallTrail: (point, facts) => effectsAdapter.recordTrail(Object.freeze({ ...point }), Object.freeze({ ...facts })),
    emitParticles: (facts) => effectsAdapter.emitParticles(Object.freeze({ ...facts })),
    emitContextParticles: (facts) => effectsAdapter.emitContextParticles(Object.freeze({ ...facts })),
    diagnostics: () => Object.freeze({ settings: settingsAdapter.diagnostics(), effects: effectsAdapter.diagnostics(), direction: "outward-only", removalOwner: "TON-65" }),
  });

  Object.defineProperty(globalThis.window, "__TONY_THREE_SCENE_BRIDGE__", { value: sceneBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_CAMERA_REPLAY_BRIDGE__", { value: cameraReplayBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_MODEL_VIEW_BRIDGE__", { value: modelViewBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_CANVAS_MATCH_BRIDGE__", { value: canvasMatchBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_SETTINGS_EFFECTS_BRIDGE__", { value: settingsEffectsBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_COMPATIBILITY_PRESENTATION_PORT__", { value: compatibilityPresentationPort, configurable: false, enumerable: false, writable: false });

  globalThis.window.__TONY_PRESENTATION_ADAPTER_FACTORIES__ = Object.freeze([
    () => cameraReplayAdapter,
    () => settingsAdapter,
    () => effectsAdapter,
    ({ target, document }) => {
      const adapter = createBrowserThreeSceneEnvironmentAdapter({ target, document, onHostChanged: (port) => sceneFacade.bind(port) });
      sceneAdapter = wrapProjectedSceneAdapter(adapter, () => cameraReplayAdapter.projection(), () => sceneFacade.bound ? sceneFacade.port : null);
      return sceneAdapter;
    },
    ({ target, document }) => {
      modelViewAdapter = createBrowserModelViewAdapter({ target, document, getScenePort: () => sceneFacade.port, isSceneBound: () => sceneFacade.bound });
      return wrapProjectedAdapter(modelViewAdapter, () => cameraReplayAdapter.projection(), "webgl-model", (frame) => effectsAdapter.projectFrame(frame));
    },
    ({ document }) => wrapProjectedAdapter(createBrowserEffectsViewAdapter({ document, getScenePort: () => sceneFacade.bound ? sceneFacade.port : null }), () => cameraReplayAdapter.projection(), "webgl-effects", (frame) => effectsAdapter.projectFrame(frame)),
    ({ target, document }) => {
      const renderer = createCanvasMatchRenderer({ target, document });
      canvasMatchRenderer = wrapProjectedAdapter(renderer, () => cameraReplayAdapter.projection(), "canvas-match", (frame) => effectsAdapter.projectFrame(frame));
      return canvasMatchRenderer;
    },
  ]);

  const sanitized = sanitizeBrowserRuntimeSearch(globalThis.location.search);
  if (sanitized.changed) globalThis.history.replaceState(globalThis.history.state, "", `${globalThis.location.pathname}${sanitized.search}${globalThis.location.hash}`);
  await import("./generated/game.js?v=25.0.0");
  removeBrowserGameplayDebugMutators(globalThis.window.__TONY_DEBUG__);
  exposeBrowserPresentationDiagnostics(globalThis.window.__TONY_DEBUG__, modelViewBridge, { threeScene: sceneBridge, canvasMatch: canvasMatchBridge, cameraReplay: cameraReplayBridge });
  if (globalThis.window.__TONY_DEBUG__ && Object.isExtensible(globalThis.window.__TONY_DEBUG__)) Object.defineProperty(globalThis.window.__TONY_DEBUG__, "settingsEffects", { configurable: true, enumerable: true, get: () => settingsEffectsBridge.diagnostics() });
}
