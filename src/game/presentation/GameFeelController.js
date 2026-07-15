const DEFAULTS = Object.freeze({
  camera: Object.freeze({
    followHz: 5.4,
    replayFollowHz: 8.2,
    lookHz: 7.5,
    impulseDecayHz: 10,
    maxImpulse: 1,
  }),
  feedback: Object.freeze({
    flashDecayPerSecond: 2.8,
    strongShotThreshold: 0.72,
    strongShotImpulse: 0.62,
    tackleImpulse: 0.28,
    goalImpulse: 0.95,
  }),
  ball: Object.freeze({
    trailMinSpeed: 150,
    trailMaxSpeed: 900,
    trailMinPoints: 4,
    trailMaxPoints: 14,
    lowPowerTrailMaxPoints: 7,
    shadowMinScale: 0.42,
    shadowMaxHeight: 12,
  }),
  particles: Object.freeze({
    desktopBudget: 240,
    lowPowerBudget: 90,
    reducedMotionBudget: 36,
  }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const expEase = (hz, dt) => 1 - Math.exp(-Math.max(0, hz) * Math.max(0, dt));

function hash01(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createGameFeelController(options = {}) {
  const config = {
    camera: { ...DEFAULTS.camera, ...(options.camera || {}) },
    feedback: { ...DEFAULTS.feedback, ...(options.feedback || {}) },
    ball: { ...DEFAULTS.ball, ...(options.ball || {}) },
    particles: { ...DEFAULTS.particles, ...(options.particles || {}) },
  };

  const lowPowerDevice = Boolean(options.lowPowerDevice);
  const reducedMotion = Boolean(options.reducedMotion);
  let impulse = 0;
  let impulseSeed = 1;

  return Object.freeze({
    config,

    addImpulse(amount, seed = impulseSeed + 1) {
      if (!Number.isFinite(amount)) return impulse;
      impulse = clamp(impulse + Math.max(0, amount), 0, config.camera.maxImpulse);
      impulseSeed = Number.isFinite(seed) ? seed : impulseSeed + 1;
      return impulse;
    },

    clear() {
      impulse = 0;
    },

    update(dt) {
      impulse *= Math.exp(-config.camera.impulseDecayHz * Math.max(0, dt));
      if (impulse < 1e-4) impulse = 0;
      return impulse;
    },

    getImpulse() {
      return impulse;
    },

    cameraEase(dt, replay = false) {
      return expEase(replay ? config.camera.replayFollowHz : config.camera.followHz, dt);
    },

    lookEase(dt) {
      return expEase(config.camera.lookHz, dt);
    },

    sampleCameraOffset(nowMilliseconds) {
      if (impulse <= 0 || reducedMotion) return { x: 0, y: 0, z: 0 };
      const frame = Math.floor(Math.max(0, nowMilliseconds) / 16.6667);
      return {
        x: (hash01(impulseSeed * 17 + frame * 3) * 2 - 1) * impulse,
        y: (hash01(impulseSeed * 29 + frame * 5) * 2 - 1) * impulse * 0.55,
        z: (hash01(impulseSeed * 41 + frame * 7) * 2 - 1) * impulse * 0.38,
      };
    },

    decayFlash(value, dt) {
      const rate = reducedMotion ? config.feedback.flashDecayPerSecond * 1.7 : config.feedback.flashDecayPerSecond;
      return Math.max(0, value - rate * Math.max(0, dt));
    },

    shotImpulse(charge) {
      const normalized = clamp((charge - config.feedback.strongShotThreshold) / (1 - config.feedback.strongShotThreshold), 0, 1);
      return normalized * config.feedback.strongShotImpulse;
    },

    trailPointCount(speed) {
      if (reducedMotion) return config.ball.trailMinPoints;
      const maxPoints = lowPowerDevice ? config.ball.lowPowerTrailMaxPoints : config.ball.trailMaxPoints;
      const normalized = clamp((speed - config.ball.trailMinSpeed) / (config.ball.trailMaxSpeed - config.ball.trailMinSpeed), 0, 1);
      return Math.round(config.ball.trailMinPoints + (maxPoints - config.ball.trailMinPoints) * normalized);
    },

    trailOpacity(index, count, speed) {
      if (count <= 0 || speed < config.ball.trailMinSpeed) return 0;
      const age = clamp(index / count, 0, 1);
      const speedStrength = clamp((speed - config.ball.trailMinSpeed) / 500, 0, 1);
      return (1 - age) ** 1.7 * (0.06 + speedStrength * (reducedMotion ? 0.08 : 0.2));
    },

    ballShadow(height) {
      const normalized = clamp(height / config.ball.shadowMaxHeight, 0, 1);
      return {
        scale: 1 - normalized * (1 - config.ball.shadowMinScale),
        opacity: 0.38 * (1 - normalized * 0.72),
      };
    },

    particleBudget() {
      if (reducedMotion) return config.particles.reducedMotionBudget;
      return lowPowerDevice ? config.particles.lowPowerBudget : config.particles.desktopBudget;
    },
  });
}
