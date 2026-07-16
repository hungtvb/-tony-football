import { GameCommandType } from "../engine/GameCommands.js";

const kickCommandTypes = new Set([
  GameCommandType.SHORT_PASS,
  GameCommandType.THROUGH_BALL,
  GameCommandType.LOFTED_PASS,
  GameCommandType.SHOOT
]);

function requireStableId(value, name, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function requireFinitePoint(value, name) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${name} must contain finite x and y values`);
  }
}

function requireFiniteVelocity(value) {
  if (
    !value
    || !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) throw new TypeError("velocity must contain finite x, y, and z values");
}

export function createCompatibilityKickEventPayload({
  commandType,
  playerId,
  targetId = null,
  power,
  speed,
  style,
  position,
  velocity,
  aimY = null,
  presentation = {}
}) {
  if (!kickCommandTypes.has(commandType)) {
    throw new TypeError(`Unsupported compatibility kick command: ${commandType}`);
  }
  requireStableId(playerId, "playerId");
  requireStableId(targetId, "targetId", { nullable: true });
  if (!Number.isFinite(power) || power < 0 || power > 1) {
    throw new RangeError("power must be between 0 and 1");
  }
  if (!Number.isFinite(speed) || speed < 0) {
    throw new RangeError("speed must be a non-negative finite number");
  }
  if (typeof style !== "string" || style.length === 0) {
    throw new TypeError("style must be a non-empty string");
  }
  if (aimY !== null && !Number.isFinite(aimY)) {
    throw new TypeError("aimY must be null or a finite number");
  }
  requireFinitePoint(position, "position");
  requireFiniteVelocity(velocity);

  return Object.freeze({
    ...presentation,
    type: commandType,
    playerId,
    ballId: "match-ball",
    targetId,
    power,
    speed,
    style,
    aimY,
    velocity: Object.freeze({ ...velocity }),
    x: position.x,
    y: position.y
  });
}
