import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

import { createBrowserThreeSceneEnvironmentAdapter } from "./src/game/presentation/BrowserThreeSceneEnvironmentAdapterFactory.js";
import { installLegacyThreeSceneTracking } from "./src/game/presentation/LegacyThreeSceneRegistry.js";

const BLOCKED_GAMEPLAY_PARAMS = Object.freeze([
  "runtime",
  "debugScenario",
]);

export function sanitizeBrowserRuntimeSearch(search = "") {
  const params = new URLSearchParams(search);
  let changed = false;
  for (const name of BLOCKED_GAMEPLAY_PARAMS) {
    if (!params.has(name)) continue;
    params.delete(name);
    changed = true;
  }
  return {
    changed,
    search: params.size > 0 ? `?${params.toString()}` : "",
  };
}

export function removeBrowserGameplayDebugMutators(debug = null) {
  if (!debug || typeof debug !== "object") return false;
  const removed = Object.prototype.hasOwnProperty.call(debug, "applyScenario");
  if (removed) delete debug.applyScenario;
  return removed;
}

if (typeof globalThis.window !== "undefined") {
  installLegacyThreeSceneTracking({ THREE, EffectComposer });
  globalThis.window.__TONY_PRESENTATION_ADAPTER_FACTORIES__ = Object.freeze([
    ({ target, document }) => createBrowserThreeSceneEnvironmentAdapter({ target, document }),
  ]);

  const sanitized = sanitizeBrowserRuntimeSearch(globalThis.location.search);
  if (sanitized.changed) {
    globalThis.history.replaceState(
      globalThis.history.state,
      "",
      `${globalThis.location.pathname}${sanitized.search}${globalThis.location.hash}`,
    );
  }
  await import("./game.js?v=20.0.0");
  removeBrowserGameplayDebugMutators(globalThis.window.__TONY_DEBUG__);
}
