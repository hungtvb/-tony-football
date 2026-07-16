import { cameraFrameTarget, cameraZoomForSpeed } from "./CameraFraming.js";

const lerp = (from, to, progress) => from + (to - from) * progress;

function freezeState(x, y, zoom, targetZoom) {
  return Object.freeze({ x, y, zoom, targetZoom });
}

export function createSnapshotCameraController({
  worldWidth,
  worldHeight,
  viewportWidth = worldWidth,
  viewportHeight = worldHeight,
  config,
  initialX = worldWidth / 2,
  initialY = worldHeight / 2,
  initialZoom = 1
}) {
  if (![worldWidth, worldHeight, viewportWidth, viewportHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("snapshot camera dimensions must be positive finite numbers");
  }
  if (!config) throw new TypeError("snapshot camera requires framing config");

  let state = freezeState(initialX, initialY, initialZoom, initialZoom);

  return Object.freeze({
    get state() {
      return state;
    },

    reset({ x = initialX, y = initialY, zoom = initialZoom } = {}) {
      state = freezeState(x, y, zoom, zoom);
      return state;
    },

    update(snapshot, dt) {
      if (!snapshot?.match || !snapshot?.ball) throw new TypeError("snapshot camera requires a match snapshot");
      if (!Number.isFinite(dt) || dt < 0) throw new TypeError("snapshot camera dt must be a non-negative finite number");

      const active = snapshot.match.state === "playing" || snapshot.match.state === "paused";
      const targetZoom = active
        ? cameraZoomForSpeed(Math.hypot(snapshot.ball.vx ?? 0, snapshot.ball.vy ?? 0), config)
        : config.baseZoom;
      const frame = active
        ? cameraFrameTarget({
            cameraX: state.x,
            cameraY: state.y,
            subjectX: snapshot.ball.x,
            subjectY: snapshot.ball.y,
            velocityX: snapshot.ball.vx ?? 0,
            velocityY: snapshot.ball.vy ?? 0,
            worldWidth,
            worldHeight,
            viewportWidth,
            viewportHeight,
            zoom: targetZoom,
            config
          })
        : { x: worldWidth / 2, y: worldHeight / 2 };
      const followEase = 1 - Math.exp(-dt * config.followRate);
      const zoomEase = 1 - Math.exp(-dt * config.zoomRate);
      state = freezeState(
        lerp(state.x, frame.x, followEase),
        lerp(state.y, frame.y, followEase),
        lerp(state.zoom, targetZoom, zoomEase),
        targetZoom
      );
      return state;
    }
  });
}
