const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;

function response(rate, dt) {
  if (!Number.isFinite(rate) || !Number.isFinite(dt) || rate <= 0 || dt <= 0) return 0;
  return 1 - Math.exp(-rate * dt);
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalize(x, y, fallbackX = 0, fallbackY = 1) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 1e-6) return Object.freeze({ x: fallbackX, y: fallbackY });
  return Object.freeze({ x: x / length, y: y / length });
}

function cadenceFor(animationState, speed) {
  if (animationState === "Sprint_Loop") return clamp(speed / 225, .82, 1.42);
  if (animationState === "Jog_Fwd_Loop") return clamp(speed / 160, .78, 1.34);
  return 1;
}

export function createPlayerMotionPresentationState({ vx = 0, vy = 0 } = {}) {
  return {
    previousVx: finite(vx),
    previousVy: finite(vy),
    forwardLean: 0,
    lateralLean: 0,
    compression: 0,
    animationTimeScale: 1,
    initialized: false,
  };
}

export function resetPlayerMotionPresentationState(state, { vx = 0, vy = 0 } = {}) {
  if (!state || typeof state !== "object") throw new TypeError("motion presentation state is required");
  state.previousVx = finite(vx);
  state.previousVy = finite(vy);
  state.forwardLean = 0;
  state.lateralLean = 0;
  state.compression = 0;
  state.animationTimeScale = 1;
  state.initialized = false;
  return state;
}

export function stepPlayerMotionPresentation({ state, pose, dt, yaw = 0, animationState = "Idle_Loop" } = {}) {
  if (!state || typeof state !== "object") throw new TypeError("motion presentation state is required");
  if (!pose || typeof pose !== "object") throw new TypeError("player pose is required");

  const safeDt = clamp(finite(dt), 0, .05);
  const safeYaw = finite(yaw);
  const vx = finite(pose.vx);
  const vy = finite(pose.vy);
  const speed = Math.hypot(vx, vy);
  const forward = normalize(Math.sin(safeYaw), Math.cos(safeYaw));
  const inverseDt = safeDt > 1e-4 && state.initialized ? 1 / safeDt : 0;
  const accelerationX = (vx - state.previousVx) * inverseDt;
  const accelerationY = (vy - state.previousVy) * inverseDt;
  const forwardAcceleration = accelerationX * forward.x + accelerationY * forward.y;
  const lateralAcceleration = accelerationX * forward.y - accelerationY * forward.x;
  const speedRatio = clamp(speed / 292, 0, 1.18);
  const engineTurnLean = clamp(finite(pose.turnLean), -1, 1);

  const targetForwardLean = clamp(
    speedRatio * (pose.sprinting ? .115 : .078) + clamp(forwardAcceleration / 1500, -.075, .075),
    -.085,
    .17,
  );
  const targetLateralLean = clamp(
    -engineTurnLean * .16 - clamp(lateralAcceleration / 1900, -.08, .08),
    -.22,
    .22,
  );
  const braking = clamp(-forwardAcceleration / 1450, 0, 1);
  const reversal = speed > 55 && forwardAcceleration < -620 ? clamp((-forwardAcceleration - 620) / 1100, 0, 1) : 0;
  const targetCompression = clamp(braking * .055 + reversal * .045, 0, .085);
  const targetCadence = cadenceFor(animationState, speed);

  const poseAlpha = response(pose.sprinting ? 13 : 16, safeDt);
  const cadenceAlpha = response(10, safeDt);
  state.forwardLean = lerp(state.forwardLean, targetForwardLean, poseAlpha);
  state.lateralLean = lerp(state.lateralLean, targetLateralLean, poseAlpha);
  state.compression = lerp(state.compression, targetCompression, response(18, safeDt));
  state.animationTimeScale = lerp(state.animationTimeScale, targetCadence, cadenceAlpha);
  state.previousVx = vx;
  state.previousVy = vy;
  state.initialized = true;

  return Object.freeze({
    speed,
    forwardAcceleration,
    lateralAcceleration,
    forwardLean: state.forwardLean,
    lateralLean: state.lateralLean,
    compression: state.compression,
    animationTimeScale: state.animationTimeScale,
    strideRate: targetCadence,
    braking: Math.max(braking, reversal),
  });
}
