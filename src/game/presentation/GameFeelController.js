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
  };

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
      if (impulse <= 0) return { x: 0, y: 0, z: 0 };
      const frame = Math.floor(Math.max(0, nowMilliseconds) / 16.6667);
      return {
        x: (hash01(impulseSeed * 17 + frame * 3) * 2 - 1) * impulse,
        y: (hash01(impulseSeed * 29 + frame * 5) * 2 - 1) * impulse * 0.55,
        z: (hash01(impulseSeed * 41 + frame * 7) * 2 - 1) * impulse * 0.38,
      };
    },

    decayFlash(value, dt) {
      return Math.max(0, value - config.feedback.flashDecayPerSecond * Math.max(0, dt));
    },

    shotImpulse(charge) {
      const normalized = clamp((charge - config.feedback.strongShotThreshold) / (1 - config.feedback.strongShotThreshold), 0, 1);
      return normalized * config.feedback.strongShotImpulse;
    },
  });
}
