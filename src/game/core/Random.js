function hashSeed(seed) {
  const text = String(seed);
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function createSeededRandom(seed = 1) {
  let state = hashSeed(seed) || 0x6d2b79f5;

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return Object.freeze({
    next,
    range(min, max) {
      if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
        throw new RangeError("range requires finite min and max with max >= min");
      }
      return min + (max - min) * next();
    },
    chance(probability) {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new RangeError("probability must be between zero and one");
      }
      return next() < probability;
    },
  });
}
