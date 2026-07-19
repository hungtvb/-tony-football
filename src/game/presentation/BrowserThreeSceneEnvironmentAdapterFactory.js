import { createBrowserThreeSceneEnvironmentHost } from "./BrowserThreeSceneEnvironmentHost.js";
import { createLegacyAdoptedThreeSceneHost } from "./LegacyAdoptedThreeSceneHost.js";
import {
  activateLegacyThreeSceneOwnership,
  deactivateLegacyThreeSceneOwnership,
  legacyThreeSceneSnapshot,
  withLegacyThreeOwnedMutation,
  withLegacyThreeOwnedRender,
} from "./LegacyThreeSceneRegistry.js";
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

function createMigratingHost(context, { lowPowerDevice }) {
  const legacy = legacyThreeSceneSnapshot();
  const host = legacy
    ? createLegacyAdoptedThreeSceneHost({
      legacyResources: legacy,
      lowPowerDevice,
      renderScope: withLegacyThreeOwnedRender,
      mutationScope: withLegacyThreeOwnedMutation,
    })
    : createBrowserThreeSceneEnvironmentHost({ ...context, lowPowerDevice });

  if (!legacy) return host;
  return Object.freeze({
    port: host.port,
    start() {
      host.start();
      activateLegacyThreeSceneOwnership(host.port);
      return true;
    },
    resize: (viewport) => host.resize(viewport),
    render: (frame) => host.render(frame),
    reset: (contextValue) => host.reset(contextValue),
    dispose() {
      deactivateLegacyThreeSceneOwnership();
      return host.dispose();
    },
  });
}

export function createBrowserThreeSceneEnvironmentAdapter({
  target,
  document,
  lowPowerDevice = defaultLowPowerDevice(target),
  onHostChanged = () => {},
  onFallback = (fallback) => requestCanvasFallback(target, fallback),
} = {}) {
  return createThreeSceneEnvironmentAdapter({
    target,
    document,
    onHostChanged,
    onFallback,
    createSceneHost: (context) => createMigratingHost(context, { lowPowerDevice }),
  });
}
