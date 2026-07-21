import { cameraHudConfig } from "./src/game/config/cameraHudConfig.js";
import { createCanvasMatchRenderer } from "./src/game/presentation/CanvasMatchRenderer.js";
import { createBrowserModelViewAdapter } from "./src/game/presentation/BrowserModelViewAdapter.js";
import { createBrowserThreeSceneEnvironmentAdapter } from "./src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js";
import { createRebindableThreeSceneHostPort } from "./src/game/presentation/RebindableThreeSceneHostPort.js";
import { createSnapshotCameraReplayAdapter } from "./src/game/presentation/SnapshotCameraReplayAdapter.js";
import { createBrowserSettingsAdapter } from "./src/game/presentation/BrowserSettingsAdapter.js";
import { createBrowserEffectsAdapter } from "./src/game/presentation/BrowserEffectsAdapter.js";
import { FO4_CONTROLS } from "./src/game/input/FO4Controls.js";

const BLOCKED_GAMEPLAY_PARAMS = Object.freeze(["runtime", "debugScenario"]);

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

export function exposeBrowserPresentationDiagnostics(debug, modelViewBridge) {
  if (!debug || typeof debug !== "object" || !Object.isExtensible(debug)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(debug, "modelViews");
  if (descriptor && descriptor.configurable === false) return false;
  Object.defineProperty(debug, "modelViews", { configurable: true, enumerable: true, get: () => modelViewBridge.diagnostics() });
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

function wrapProjectedAdapter(adapter, getProjection, owner) {
  let consumedProjectionSequence = 0;
  return Object.freeze({
    attach: (...args) => adapter.attach?.(...args),
    render(frame) {
      const projection = getProjection();
      if (projection?.projectionSequence) consumedProjectionSequence = projection.projectionSequence;
      return adapter.render?.(projectedPresentationFrame(frame, projection));
    },
    reset: (...args) => { consumedProjectionSequence = 0; return adapter.reset?.(...args); },
    teardown: (...args) => adapter.teardown?.(...args),
    diagnostics: () => Object.freeze({ ...(adapter.diagnostics?.() ?? {}), cameraReplayConsumer: owner, consumedProjectionSequence, camera: getProjection()?.camera ?? null, replay: getProjection()?.replay ?? null }),
  });
}

if (typeof globalThis.window !== "undefined") {
  const sceneFacade = createRebindableThreeSceneHostPort();
  const cameraReplayAdapter = createSnapshotCameraReplayAdapter({ worldWidth: 1200, worldHeight: 700, viewportWidth: 1200, viewportHeight: 700, cameraConfig: cameraHudConfig.camera });
  const settingsAdapter = createBrowserSettingsAdapter({ target: globalThis.window, document: globalThis.document, controlBindings: FO4_CONTROLS });
  const effectsAdapter = createBrowserEffectsAdapter({ target: globalThis.window, lowPowerDevice: globalThis.navigator?.hardwareConcurrency <= 4, reducedMotion: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches });
  let modelViewAdapter = null; let canvasMatchRenderer = null;
  const sceneBridge = Object.freeze({ getPort: () => sceneFacade.bound ? sceneFacade.port : null, getStablePort: () => sceneFacade.port, diagnostics: () => sceneFacade.port.diagnostics() });
  const cameraReplayBridge = Object.freeze({ camera: cameraReplayAdapter.camera, replay: cameraReplayAdapter.replay, projection: () => cameraReplayAdapter.projection(), diagnostics: () => cameraReplayAdapter.diagnostics() });
  const modelViewBridge = Object.freeze({ diagnostics: () => modelViewAdapter?.diagnostics?.() ?? Object.freeze({ owner: "browser-model-views", attached: false, playerCount: 0, ballAttached: false, assetState: "idle" }) });
  const canvasMatchBridge = Object.freeze({ diagnostics: () => canvasMatchRenderer?.diagnostics?.() ?? Object.freeze({ owner: "canvas-match-renderer", attached: false, active: false, status: "idle", renderCount: 0, lastFacts: null }) });
  const settingsEffectsBridge = Object.freeze({ settings: settingsAdapter, effects: effectsAdapter, diagnostics: () => Object.freeze({ settings: settingsAdapter.diagnostics(), effects: effectsAdapter.diagnostics() }) });

  Object.defineProperty(globalThis.window, "__TONY_THREE_SCENE_BRIDGE__", { value: sceneBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_CAMERA_REPLAY_BRIDGE__", { value: cameraReplayBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_MODEL_VIEW_BRIDGE__", { value: modelViewBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_CANVAS_MATCH_BRIDGE__", { value: canvasMatchBridge, configurable: false, enumerable: false, writable: false });
  Object.defineProperty(globalThis.window, "__TONY_SETTINGS_EFFECTS_BRIDGE__", { value: settingsEffectsBridge, configurable: false, enumerable: false, writable: false });

  globalThis.window.__TONY_PRESENTATION_ADAPTER_FACTORIES__ = Object.freeze([
    () => cameraReplayAdapter,
    () => settingsAdapter,
    () => effectsAdapter,
    ({ target, document }) => {
      modelViewAdapter = createBrowserModelViewAdapter({ target, document, getScenePort: () => sceneFacade.port, isSceneBound: () => sceneFacade.bound });
      return wrapProjectedAdapter(modelViewAdapter, () => cameraReplayAdapter.projection(), "webgl-model");
    },
    ({ target, document }) => createBrowserThreeSceneEnvironmentAdapter({ target, document, onHostChanged: (port) => sceneFacade.bind(port) }),
    ({ target, document }) => {
      const renderer = createCanvasMatchRenderer({ target, document });
      canvasMatchRenderer = wrapProjectedAdapter(renderer, () => cameraReplayAdapter.projection(), "canvas-match");
      return canvasMatchRenderer;
    },
  ]);

  const sanitized = sanitizeBrowserRuntimeSearch(globalThis.location.search);
  if (sanitized.changed) globalThis.history.replaceState(globalThis.history.state, "", `${globalThis.location.pathname}${sanitized.search}${globalThis.location.hash}`);
  await import("./generated/game.js?v=24.0.0");
  removeBrowserGameplayDebugMutators(globalThis.window.__TONY_DEBUG__);
  exposeBrowserPresentationDiagnostics(globalThis.window.__TONY_DEBUG__, modelViewBridge);
  if (globalThis.window.__TONY_DEBUG__ && Object.isExtensible(globalThis.window.__TONY_DEBUG__)) Object.defineProperty(globalThis.window.__TONY_DEBUG__, "settingsEffects", { configurable: true, enumerable: true, get: () => settingsEffectsBridge.diagnostics() });
}
