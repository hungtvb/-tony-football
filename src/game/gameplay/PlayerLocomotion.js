const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return { x: fallbackX, y: fallbackY };
  return { x: x / length, y: y / length };
}

export function normalizeMovementInput(x, y) {
  const magnitude = Math.min(1, Math.hypot(x, y));
  if (magnitude <= 1e-9) return Object.freeze({ x: 0, y: 0, magnitude: 0 });
  const direction = normalize(x, y);
  return Object.freeze({ x: direction.x, y: direction.y, magnitude });
}

export function exponentialResponse(rate, dt) {
  if (!Number.isFinite(rate) || !Number.isFinite(dt) || rate <= 0 || dt <= 0) return 0;
  return 1 - Math.exp(-rate * dt);
}

export function chooseTurnResponse({ currentX, currentY, desiredX, desiredY, config, boosted = false }) {
  const current = normalize(currentX, currentY, desiredX, desiredY);
  const desired = normalize(desiredX, desiredY, current.x, current.y);
  const turnDot = clamp(current.x * desired.x + current.y * desired.y, -1, 1);
  const response = turnDot < -0.15
    ? config.reversalResponse
    : boosted
      ? config.boostedAccelerationResponse
      : config.accelerationResponse;
  const turnGrip = clamp(config.turnGripBase + (turnDot + 1) * config.turnGripScale, config.turnGripBase, 1);
  return Object.freeze({ response, turnDot, turnGrip });
}

export function stepVelocity({ vx, vy, desiredX, desiredY, targetSpeed, dt, response, turnGrip = 1 }) {
  const alpha = exponentialResponse(response, dt);
  return Object.freeze({
    vx: lerp(vx, desiredX * targetSpeed * turnGrip, alpha),
    vy: lerp(vy, desiredY * targetSpeed * turnGrip, alpha),
  });
}

export function dampVelocity({ vx, vy, dt, damping }) {
  const factor = Math.pow(clamp(damping, 0, 1), Math.max(0, dt));
  return Object.freeze({ vx: vx * factor, vy: vy * factor });
}

export function stepFacing({ dirX, dirY, targetX, targetY, dt, response }) {
  const alpha = exponentialResponse(response, dt);
  const blended = normalize(
    lerp(dirX, targetX, alpha),
    lerp(dirY, targetY, alpha),
    dirX || 1,
    dirY || 0,
  );
  return Object.freeze({ dirX: blended.x, dirY: blended.y });
}

export function stepTowardTarget({ x, y, vx, vy, dirX, dirY, targetX, targetY, speed, dt, config }) {
  const dx = targetX - x;
  const dy = targetY - y;
  const distance = Math.hypot(dx, dy);
  const desired = normalize(dx, dy, dirX || 1, dirY || 0);
  let velocity = stepVelocity({
    vx,
    vy,
    desiredX: desired.x,
    desiredY: desired.y,
    targetSpeed: speed,
    dt,
    response: config.movementResponse,
  });
  if (distance < config.arrivalRadius) {
    velocity = Object.freeze({
      vx: velocity.vx * config.arrivalDamping,
      vy: velocity.vy * config.arrivalDamping,
    });
  }
  let facing = Object.freeze({ dirX, dirY });
  if (Math.abs(velocity.vx) + Math.abs(velocity.vy) > config.facingVelocityThreshold) {
    const direction = normalize(velocity.vx, velocity.vy, dirX || 1, dirY || 0);
    facing = Object.freeze({ dirX: direction.x, dirY: direction.y });
  }
  return Object.freeze({ ...velocity, ...facing, distance });
}

export function stepStamina({ stamina, moving, sprinting, precision, magnitude, dt, config }) {
  let next = stamina;
  if (moving) {
    const drain = sprinting
      ? config.sprintDrainPerSecond * magnitude
      : precision
        ? config.precisionDrainPerSecond
        : config.movementDrainPerSecond;
    next -= drain * dt;
  } else {
    next += (precision ? config.precisionRecoveryPerSecond : config.staminaRecoveryPerSecond) * dt;
  }
  return clamp(next, 0, 100);
}
