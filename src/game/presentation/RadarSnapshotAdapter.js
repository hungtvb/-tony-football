import { cameraHudConfig } from "../config/cameraHudConfig.js";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../config/simulationScaleProfile.js";
import {
  claimRadarSnapshotContext,
  renderOwnedRadarSnapshot,
} from "./RadarSnapshotRenderer.js";

export const DEFAULT_RADAR_FIELD = Object.freeze({
  ...DEFAULT_SIMULATION_SCALE_PROFILE.field.bounds,
});

function requireDocument(document) {
  if (!document || typeof document.getElementById !== "function") {
    throw new TypeError("RadarSnapshotAdapter requires a document");
  }
}

export function createRadarSnapshotAdapter({
  document,
  field = DEFAULT_RADAR_FIELD,
  config = cameraHudConfig.radar,
} = {}) {
  requireDocument(document);
  const canvas = document.getElementById("radarCanvas");
  const context = canvas?.getContext?.("2d") ?? null;
  let releaseContext = null;

  return Object.freeze({
    attach() {
      if (!context || releaseContext) return false;
      releaseContext = claimRadarSnapshotContext(context);
      return true;
    },

    render(frame = {}) {
      if (!context || !releaseContext || !frame.snapshot) return false;
      return renderOwnedRadarSnapshot(context, frame.snapshot, {
        width: canvas.width ?? config.width,
        height: canvas.height ?? config.height,
        field,
        config,
      });
    },

    reset() {
      if (!context || !releaseContext) return false;
      context.clearRect(0, 0, canvas.width ?? config.width, canvas.height ?? config.height);
      return true;
    },

    teardown() {
      if (!releaseContext) return false;
      const release = releaseContext;
      releaseContext = null;
      return release();
    },
  });
}
