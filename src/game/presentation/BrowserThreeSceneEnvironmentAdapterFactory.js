import * as THREE from "three";

import { createBrowserThreeSceneEnvironmentHost } from "./BrowserThreeSceneEnvironmentHost.js";
import {
  activateLegacyThreeSceneOwnership,
  deactivateLegacyThreeSceneOwnership,
  legacyThreeSceneSnapshot,
  ownedThreeSceneSnapshot,
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

function cameraPose(camera) {
  if (!camera?.position || typeof camera.getWorldDirection !== "function") return null;
  const direction = camera.getWorldDirection(new THREE.Vector3());
  return Object.freeze({
    position: Object.freeze({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
    lookAt: Object.freeze({
      x: camera.position.x + direction.x * 20,
      y: camera.position.y + direction.y * 20,
      z: camera.position.z + direction.z * 20,
    }),
  });
}

function applyEnvironmentAppearance(frame) {
  const owned = ownedThreeSceneSnapshot();
  if (!owned) return;
  const match = frame?.snapshot?.match ?? {};
  const settings = match.settings ?? {};
  const night = settings.pitchStyle === "midnight";
  const goalPulse = Boolean(match.goalSequence || match.goalPhase || match.replay?.active);
  owned.scene.background?.set?.(night ? 0x020708 : 0x07100d);
  owned.scene.fog?.color?.set?.(night ? 0x030908 : 0x07110e);
  owned.renderer.toneMappingExposure = night ? 1.22 : 1.12;
  owned.scene.traverse?.((object) => {
    if (object.isHemisphereLight) object.intensity = night ? 1.05 : 1.45;
    else if (object.isDirectionalLight) {
      const rim = object.color?.getHex?.() === 0x70dcff;
      object.intensity = (rim ? (night ? 1.85 : 1.4) : (night ? 4.35 : 3.4)) + (goalPulse ? (rim ? 0.25 : 0.45) : 0);
    } else if (object.isPointLight) object.intensity = (night ? 30 : 20) + (goalPulse ? 8 : 0);
    if (object.isPoints && object.material) object.material.size = goalPulse ? 0.39 : 0.34;
    if (object.material?.emissive && object.material.emissiveIntensity !== undefined) {
      object.material.emissiveIntensity = goalPulse ? 0.55 : 0.32;
    }
  });
}

function createMigratingHost(context, { lowPowerDevice }) {
  const legacy = legacyThreeSceneSnapshot();
  const host = createBrowserThreeSceneEnvironmentHost({ ...context, lowPowerDevice });
  if (!legacy) return host;

  return Object.freeze({
    port: host.port,
    start() {
      host.start();
      for (const object of legacy.legacyObjects) {
        legacy.scene.remove(object);
        host.port.addObject(object);
      }
      activateLegacyThreeSceneOwnership(host.port);
      return true;
    },
    resize(viewport) {
      return host.resize(viewport);
    },
    render(frame) {
      const pose = cameraPose(legacy.camera);
      if (pose) host.port.setCameraPose(pose);
      applyEnvironmentAppearance(frame);
      const settings = frame?.snapshot?.match?.settings ?? {};
      const snapshot = Object.freeze({ ...frame.snapshot, settings });
      return withLegacyThreeOwnedRender(() => host.render(Object.freeze({ ...frame, snapshot })));
    },
    reset(contextValue) {
      return host.reset(contextValue);
    },
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
