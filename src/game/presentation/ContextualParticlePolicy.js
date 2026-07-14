const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const PALETTES = Object.freeze({
  grass: Object.freeze(["#b7cf75", "#6f9b54", "#d6df9b"]),
  dust: Object.freeze(["#c9aa78", "#8d6f4d", "#e0c59a"]),
  rain: Object.freeze(["#b9e7ff", "#74bde8", "#dff6ff"]),
});

export function createContextualParticlePolicy(options = {}) {
  const lowPowerDevice = Boolean(options.lowPowerDevice);
  const reducedMotion = Boolean(options.reducedMotion);
  const burstScale = reducedMotion ? 0.35 : lowPowerDevice ? 0.6 : 1;

  function contextFor({ weather = "clear", pitchStyle = "classic" } = {}) {
    if (weather === "rain") return "rain";
    if (pitchStyle === "dry") return "dust";
    return "grass";
  }

  function burst({ energy = 1, weather = "clear", pitchStyle = "classic" } = {}) {
    const context = contextFor({ weather, pitchStyle });
    const normalizedEnergy = clamp(Number.isFinite(energy) ? energy : 0, 0, 4);
    const base = context === "rain" ? 7 : context === "dust" ? 6 : 5;
    const count = Math.max(1, Math.round((base + normalizedEnergy * 4) * burstScale));
    return Object.freeze({
      context,
      count,
      colors: PALETTES[context],
      energy: context === "rain" ? normalizedEnergy * 0.72 : normalizedEnergy,
    });
  }

  return Object.freeze({ contextFor, burst });
}
