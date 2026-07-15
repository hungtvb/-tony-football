const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

export function cameraZoomForSpeed(speed, config) {
  const progress = clamp((speed - config.speedZoomOutStart) / config.speedZoomOutRange, 0, 1);
  return clamp(config.baseZoom - progress * config.maxSpeedZoomOut, config.minZoom, config.maxZoom);
}

export function cameraLookAhead(vx, vy, config) {
  const speed = Math.hypot(vx, vy);
  if (speed <= 1e-9) return Object.freeze({ x: 0, y: 0 });
  const direction = normalize(vx, vy);
  const distance = config.lookAheadMax * clamp(speed / config.lookAheadSpeed, 0, 1);
  return Object.freeze({ x: direction.x * distance, y: direction.y * distance });
}

export function deadZoneTarget({ cameraX, cameraY, subjectX, subjectY, config }) {
  const dx = subjectX - cameraX;
  const dy = subjectY - cameraY;
  const x = Math.abs(dx) <= config.deadZoneX ? cameraX : subjectX - Math.sign(dx) * config.deadZoneX;
  const y = Math.abs(dy) <= config.deadZoneY ? cameraY : subjectY - Math.sign(dy) * config.deadZoneY;
  return Object.freeze({ x, y });
}

export function clampCameraToSafeArea({ targetX, targetY, worldWidth, worldHeight, viewportWidth, viewportHeight, zoom, config }) {
  const halfWidth = viewportWidth / (zoom * 2);
  const halfHeight = viewportHeight / (zoom * 2);
  const minX = halfWidth - config.safeInsetX;
  const maxX = worldWidth - halfWidth + config.safeInsetX;
  const minY = halfHeight - config.safeInsetTop;
  const maxY = worldHeight - halfHeight + config.safeInsetBottom;
  return Object.freeze({
    x: clamp(targetX, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(targetY, Math.min(minY, maxY), Math.max(minY, maxY)),
  });
}

export function cameraFrameTarget({ cameraX, cameraY, subjectX, subjectY, velocityX, velocityY, worldWidth, worldHeight, viewportWidth, viewportHeight, zoom, config }) {
  const lookAhead = cameraLookAhead(velocityX, velocityY, config);
  const deadZone = deadZoneTarget({
    cameraX,
    cameraY,
    subjectX: subjectX + lookAhead.x,
    subjectY: subjectY + lookAhead.y,
    config,
  });
  return clampCameraToSafeArea({
    targetX: deadZone.x,
    targetY: deadZone.y,
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
    zoom,
    config,
  });
}
