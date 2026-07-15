const DEFAULT_COOLDOWNS = Object.freeze({
  kick: 0.045,
  tackle: 0.09,
  whistle: 0.22,
  goal: 1.2,
  crowd: 0.18,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createAudioFeedbackController(options = {}) {
  const cooldowns = { ...DEFAULT_COOLDOWNS, ...(options.cooldowns || {}) };
  const lastPlayedAt = new Map();

  return Object.freeze({
    cooldowns,

    canPlay(key, nowSeconds) {
      if (!Number.isFinite(nowSeconds)) return false;
      const cooldown = Math.max(0, cooldowns[key] ?? 0);
      const previous = lastPlayedAt.get(key) ?? -Infinity;
      if (nowSeconds - previous < cooldown) return false;
      lastPlayedAt.set(key, nowSeconds);
      return true;
    },

    reset() {
      lastPlayedAt.clear();
    },

    kickProfile(power = 0.5) {
      const normalized = clamp(power, 0, 1);
      return {
        frequency: 105 + normalized * 115,
        duration: 0.055 + normalized * 0.055,
        volume: 0.022 + normalized * 0.035,
      };
    },

    tackleProfile(intensity = 0.5) {
      const normalized = clamp(intensity, 0, 1);
      return {
        frequency: 72 + normalized * 48,
        duration: 0.065 + normalized * 0.045,
        volume: 0.018 + normalized * 0.024,
      };
    },
  });
}
