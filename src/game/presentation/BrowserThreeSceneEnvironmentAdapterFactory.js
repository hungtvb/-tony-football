import { createBrowserThreeSceneEnvironmentHost } from "./BrowserThreeSceneEnvironmentHost.js";
import { DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE } from "./ThreeSceneEnvironmentProfile.js";
import { createThreeSceneEnvironmentAdapter } from "./ThreeSceneEnvironmentAdapter.js";

export const DEFAULT_WEBGL_CONTEXT_RESTORE_GRACE_MILLISECONDS = 1500;

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

export function createBrowserThreeSceneFallbackPolicy({
  target,
  contextRestoreGraceMilliseconds = DEFAULT_WEBGL_CONTEXT_RESTORE_GRACE_MILLISECONDS,
  scheduleTimeout = globalThis.setTimeout?.bind(globalThis),
  cancelTimeout = globalThis.clearTimeout?.bind(globalThis),
} = {}) {
  if (!Number.isFinite(contextRestoreGraceMilliseconds) || contextRestoreGraceMilliseconds < 0) {
    throw new TypeError("contextRestoreGraceMilliseconds must be a finite non-negative number");
  }
  if (typeof scheduleTimeout !== "function" || typeof cancelTimeout !== "function") {
    throw new TypeError("fallback policy requires timeout scheduling functions");
  }

  let pendingContextLossTimer;

  function cancelPendingContextLossFallback() {
    if (pendingContextLossTimer === undefined) return false;
    cancelTimeout(pendingContextLossTimer);
    pendingContextLossTimer = undefined;
    return true;
  }

  function handleFallback(fallback) {
    if (fallback?.reason === "webgl-context-lost" && fallback.recoverable) {
      cancelPendingContextLossFallback();
      pendingContextLossTimer = scheduleTimeout(() => {
        pendingContextLossTimer = undefined;
        requestCanvasFallback(target, fallback);
      }, contextRestoreGraceMilliseconds);
      return true;
    }
    cancelPendingContextLossFallback();
    return requestCanvasFallback(target, fallback);
  }

  function handleHostChanged(port) {
    if (port) cancelPendingContextLossFallback();
  }

  return Object.freeze({
    handleFallback,
    handleHostChanged,
    cancel: cancelPendingContextLossFallback,
    get pending() { return pendingContextLossTimer !== undefined; },
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
  contextRestoreGraceMilliseconds = DEFAULT_WEBGL_CONTEXT_RESTORE_GRACE_MILLISECONDS,
  scheduleTimeout = globalThis.setTimeout?.bind(globalThis),
  cancelTimeout = globalThis.clearTimeout?.bind(globalThis),
} = {}) {
  const fallbackPolicy = createBrowserThreeSceneFallbackPolicy({
    target,
    contextRestoreGraceMilliseconds,
    scheduleTimeout,
    cancelTimeout,
  });
  const adapter = createThreeSceneEnvironmentAdapter({
    target,
    document,
    onHostChanged: (port) => {
      fallbackPolicy.handleHostChanged(port);
      onHostChanged(port);
    },
    onFallback: (fallback) => {
      fallbackPolicy.handleFallback(fallback);
      onFallback(fallback);
    },
    createSceneHost,
  });

  return Object.freeze({
    get attached() { return adapter.attached; },
    get status() { return adapter.status; },
    get fallback() { return adapter.fallback; },
    get port() { return adapter.port; },
    attach: () => adapter.attach(),
    render: (frame) => adapter.render(frame),
    reset: (context) => adapter.reset(context),
    teardown() {
      fallbackPolicy.cancel();
      return adapter.teardown();
    },
  });
}
