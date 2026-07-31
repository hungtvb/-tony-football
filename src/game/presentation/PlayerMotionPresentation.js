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

function smoothstep(edge0, edge1, value) {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function cadenceFor(animationState, speed) {
  if (animationState === "Sprint_Loop") return clamp(speed / 225, .82, 1.42);
  if (animationState === "Jog_Fwd_Loop") return clamp(speed / 160, .78, 1.34);
  return 1;
}

function actionProfile(pose) {
  const action = ["shoot", "pass", "receive"].includes(pose.anim) ? pose.anim : "none";
  const duration = Math.max(0, finite(pose.animDuration));
  const remaining = clamp(finite(pose.animTime), 0, duration || 0);
  const progress = duration > 1e-4 ? clamp(1 - remaining / duration, 0, 1) : 1;
  if (action === "none" || duration <= 1e-4 || remaining <= 0) {
    return Object.freeze({
      action: "none",
      progress: 1,
      contactWeight: 0,
      followThrough: 0,
      plantStrength: 0,
      cadenceScale: 1,
      forwardLeanOffset: 0,
      compressionOffset: 0,
    });
  }

  const contactWindow = action === "shoot" ? .16 : action === "pass" ? .2 : .28;
  const contactWeight = 1 - smoothstep(0, contactWindow, progress);
  const followThrough = action === "receive"
    ? Math.sin(Math.PI * clamp(progress / .82, 0, 1))
    : Math.sin(Math.PI * clamp((progress - .015) / .78, 0, 1));

  if (action === "receive") {
    const plantStrength = clamp(contactWeight * .82 + followThrough * .42, 0, 1);
    return Object.freeze({
      action,
      progress,
      contactWeight,
      followThrough,
      plantStrength,
      cadenceScale: lerp(1, .38, plantStrength),
      forwardLeanOffset: -contactWeight * .045 + followThrough * .018,
      compressionOffset: contactWeight * .045 + followThrough * .024,
    });
  }

  const power = clamp(finite(pose.animPower), 0, 1);
  const plantStrength = clamp(contactWeight * .9 + followThrough * .36, 0, 1);
  const kickScale = action === "shoot" ? lerp(.9, 1.18, power) : lerp(.78, .96, power);
  return Object.freeze({
    action,
    progress,
    contactWeight,
    followThrough,
    plantStrength,
    cadenceScale: lerp(1, action === "shoot" ? .28 : .42, plantStrength),
    forwardLeanOffset: contactWeight * .015 + followThrough * .046 * kickScale,
    compressionOffset: contactWeight * .026 + followThrough * .015,
  });
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
  const action = actionProfile(pose);

  const targetForwardLean = clamp(
    speedRatio * (pose.sprinting ? .115 : .078)
      + clamp(forwardAcceleration / 1500, -.075, .075)
      + action.forwardLeanOffset,
    -.095,
    .19,
  );
  const targetLateralLean = clamp(
    -engineTurnLean * .16 - clamp(lateralAcceleration / 1900, -.08, .08),
    -.22,
    .22,
  );
  const braking = clamp(-forwardAcceleration / 1450, 0, 1);
  const reversal = speed > 55 && forwardAcceleration < -620 ? clamp((-forwardAcceleration - 620) / 1100, 0, 1) : 0;
  const targetCompression = clamp(
    braking * .055 + reversal * .045 + action.compressionOffset,
    0,
    .11,
  );
  const strideRate = cadenceFor(animationState, speed);
  const targetCadence = strideRate * action.cadenceScale;

  const poseAlpha = response(action.action === "none" ? (pose.sprinting ? 13 : 16) : 22, safeDt);
  const cadenceAlpha = response(action.action === "none" ? 10 : 24, safeDt);
  state.forwardLean = lerp(state.forwardLean, targetForwardLean, poseAlpha);
  state.lateralLean = lerp(state.lateralLean, targetLateralLean, poseAlpha);
  state.compression = lerp(state.compression, targetCompression, response(action.action === "none" ? 18 : 26, safeDt));
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
    strideRate,
    braking: Math.max(braking, reversal),
    action: action.action,
    actionProgress: action.progress,
    contactWeight: action.contactWeight,
    followThrough: action.followThrough,
    plantStrength: action.plantStrength,
  });
}
