import { createBrowserThreeSceneEnvironmentHost } from "./BrowserThreeSceneEnvironmentHost.js";
import { DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE } from "./ThreeSceneEnvironmentProfile.js";
import { createThreeSceneEnvironmentAdapter } from "./ThreeSceneEnvironmentAdapter.js";

function requestCanvasFallback(target, fallback) {
  if (!fallback?.recoverable || !target?.location?.href || typeof target.location.replace !== "function") return false;
  const url = new URL(target.location.href);
  url.searchParams.set("renderer", "canvas");
  target.location.replace(url.toString());
  return true;
}

function defaultLowPowerDevice(target) {
  const visualTestMode = new URLSearchParams(target?.location?.search ?? "").get("visualTest") === "1";
  const coarsePointer = target?.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const constrainedMemory = Number(target?.navigator?.deviceMemory ?? Infinity) <= 4;
  return visualTestMode || coarsePointer || constrainedMemory;
}

export function createBrowserThreeSceneFallbackPolicy({ target } = {}) {
  return Object.freeze({
    handleFallback(fallback) {
      if (fallback?.reason === "webgl-context-lost" && fallback.recoverable) return false;
      return requestCanvasFallback(target, fallback);
    },
  });
}

export function createBrowserThreeSceneEnvironmentAdapter({
  target,
  document,
  lowPowerDevice = defaultLowPowerDevice(target),
  profile = DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE,
  onHostChanged = () => {},
  onFallback = () => {},
  createSceneHost = (context) => createBrowserThreeSceneEnvironmentHost({
    ...context,
    lowPowerDevice,
    profile,
  }),
} = {}) {
  const fallbackPolicy = createBrowserThreeSceneFallbackPolicy({ target });
  return createThreeSceneEnvironmentAdapter({
    target,
    document,
    onHostChanged,
    onFallback: (fallback) => {
      fallbackPolicy.handleFallback(fallback);
      onFallback(fallback);
    },
    createSceneHost,
  });
}
