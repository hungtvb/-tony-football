const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function createBallMotionPresentationState({ vz = 0 } = {}) {
  return {
    previousVz: finite(vz),
    impactPulse: 0,
  };
}

export function resetBallMotionPresentationState(state, { vz = 0 } = {}) {
  if (!state || typeof state !== "object") throw new TypeError("ball motion presentation state is required");
  state.previousVz = finite(vz);
  state.impactPulse = 0;
  return state;
}

export function stepBallMotionPresentation({ state, ball, dt = 1 / 60 } = {}) {
  if (!state || typeof state !== "object") throw new TypeError("ball motion presentation state is required");
  if (!ball || typeof ball !== "object") throw new TypeError("ball render facts are required");

  const safeDt = clamp(finite(dt, 1 / 60), 1 / 240, .05);
  const vx = finite(ball.vx);
  const vy = finite(ball.vy);
  const vz = finite(ball.vz);
  const height = Math.max(0, finite(ball.height));
  const angle = finite(ball.angle);
  const speed = Math.hypot(vx, vy);
  const travelYaw = speed > 1e-4 ? Math.atan2(vx, vy) : 0;
  const bounced = state.previousVz < -3 && vz >= 0 && height <= .08;
  if (bounced) state.impactPulse = clamp(Math.abs(state.previousVz) / 15, .18, 1);
  else state.impactPulse *= Math.pow(.028, safeDt);
  if (state.impactPulse < .004) state.impactPulse = 0;
  state.previousVz = vz;

  const squash = state.impactPulse * .105;
  const shadowOpacity = clamp(.34 - height * .043, .055, .34);
  const shadowScale = clamp(1 + height * .115 + speed / 3600, 1, 1.72);
  const rollX = angle * Math.cos(travelYaw);
  const rollZ = -angle * Math.sin(travelYaw);

  return Object.freeze({
    speed,
    height,
    verticalSpeed: vz,
    bounced,
    impactPulse: state.impactPulse,
    squash,
    meshScaleX: 1 + squash * .52,
    meshScaleY: 1 - squash,
    meshScaleZ: 1 + squash * .52,
    meshVerticalOffset: -squash * .08,
    shadowOpacity,
    shadowScale,
    rollX,
    rollY: angle * .22,
    rollZ,
  });
}
