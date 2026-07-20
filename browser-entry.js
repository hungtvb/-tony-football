import { createBrowserModelViewAdapter } from "./src/game/presentation/BrowserModelViewAdapter.js";
import { createBrowserThreeSceneEnvironmentAdapter } from "./src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js";
import { createRebindableThreeSceneHostPort } from "./src/game/presentation/RebindableThreeSceneHostPort.js";

const BLOCKED_GAMEPLAY_PARAMS = Object.freeze(["runtime", "debugScenario"]);

export function sanitizeBrowserRuntimeSearch(search = "") {
  const params = new URLSearchParams(search);
  let changed = false;
  for (const name of BLOCKED_GAMEPLAY_PARAMS) {
    if (!params.has(name)) continue;
    params.delete(name);
    changed = true;
  }
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
  Object.defineProperty(debug, "modelViews", {
    configurable: true,
    enumerable: true,
    get: () => modelViewBridge.diagnostics(),
  });
  return true;
}

if (typeof globalThis.window !== "undefined") {
  const sceneFacade = createRebindableThreeSceneHostPort();
  let modelViewAdapter = null;
  const sceneBridge = Object.freeze({
    getPort: () => sceneFacade.bound ? sceneFacade.port : null,
    getStablePort: () => sceneFacade.port,
    diagnostics: () => sceneFacade.port.diagnostics(),
  });
  const modelViewBridge = Object.freeze({
    diagnostics: () => modelViewAdapter?.diagnostics?.() ?? Object.freeze({
      owner: "browser-model-views",
      attached: false,
      playerCount: 0,
      ballAttached: false,
      assetState: "idle",
    }),
  });

  Object.defineProperty(globalThis.window, "__TONY_THREE_SCENE_BRIDGE__", {
    value: sceneBridge, configurable: false, enumerable: false, writable: false,
  });
  Object.defineProperty(globalThis.window, "__TONY_MODEL_VIEW_BRIDGE__", {
    value: modelViewBridge, configurable: false, enumerable: false, writable: false,
  });

  globalThis.window.__TONY_PRESENTATION_ADAPTER_FACTORIES__ = Object.freeze([
    ({ target, document }) => {
      modelViewAdapter = createBrowserModelViewAdapter({
        target,
        document,
        getScenePort: () => sceneFacade.port,
        isSceneBound: () => sceneFacade.bound,
      });
      return modelViewAdapter;
    },
    ({ target, document }) => createBrowserThreeSceneEnvironmentAdapter({
      target, document, onHostChanged: (port) => sceneFacade.bind(port),
    }),
  ]);

  const sanitized = sanitizeBrowserRuntimeSearch(globalThis.location.search);
  if (sanitized.changed) {
    globalThis.history.replaceState(globalThis.history.state, "", `${globalThis.location.pathname}${sanitized.search}${globalThis.location.hash}`);
  }
  await import("./generated/game.js?v=21.0.0");
  removeBrowserGameplayDebugMutators(globalThis.window.__TONY_DEBUG__);
  exposeBrowserPresentationDiagnostics(globalThis.window.__TONY_DEBUG__, modelViewBridge);
}
