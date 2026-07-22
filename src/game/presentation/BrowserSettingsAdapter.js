const OWNERS = new WeakMap();

const DEFAULT_KEYS = Object.freeze({ pitch: "tfPitch", ball: "tfBall", weather: "tfWeather" });
const DEFAULT_TONES = Object.freeze({
  pitch: Object.freeze({ frequency: 520, duration: 0.04, volume: 0.018 }),
  ball: Object.freeze({ frequency: 680, duration: 0.04, volume: 0.018 }),
  weather: Object.freeze({ clear: 560, rain: 330, duration: 0.05, volume: 0.018 }),
  sound: Object.freeze({ frequency: 600, duration: 0.08, volume: 0.04 }),
});

function frozenCopy(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frozenCopy(item)])));
}

function selectorFor(name) { return `[data-${name}]`; }

export function createBrowserSettingsAdapter({
  target,
  document = target?.document,
  storage = target?.localStorage,
  keys = DEFAULT_KEYS,
  toneProfiles = DEFAULT_TONES,
  controlBindings = {},
  createAudioContext = () => {
    const AudioContext = target?.AudioContext ?? target?.webkitAudioContext;
    return AudioContext ? new AudioContext() : null;
  },
} = {}) {
  if (!target || typeof target !== "object") throw new TypeError("BrowserSettingsAdapter requires a target");
  let attached = false; let disposed = false; let audioContext = null; let previewCount = 0; let audioFailureCount = 0; let audioHealth = "idle";
  let config = Object.freeze({ values: Object.freeze({}), allowed: Object.freeze({}), apply: Object.freeze({}) });
  const listeners = [];

  function save(name, value) {
    const key = keys[name]; if (!key) return false;
    try { storage?.setItem?.(key, value); return true; } catch { return false; }
  }

  function releaseAudioContext(context, { close = false } = {}) {
    if (audioContext === context) audioContext = null;
    if (close && context?.state !== "closed") {
      try { Promise.resolve(context?.close?.()).catch(() => {}); } catch { /* unavailable audio is a non-fatal fallback */ }
    }
  }

  async function readyAudioContext() {
    if (disposed) return null;
    let context = audioContext;
    if (context?.state === "closed") { releaseAudioContext(context); context = null; }
    if (!context) {
      try { context = createAudioContext?.() ?? null; } catch { context = null; }
      audioContext = context;
    }
    if (!context?.createOscillator || !context?.createGain) {
      releaseAudioContext(context); audioHealth = "unavailable"; audioFailureCount += 1; return null;
    }
    if (context.state === "suspended" || context.state === "interrupted") {
      audioHealth = "recovering";
      try { await context.resume?.(); } catch {
        releaseAudioContext(context, { close: true }); audioHealth = "unavailable"; audioFailureCount += 1; return null;
      }
      if (context.state !== "running") {
        releaseAudioContext(context, { close: true }); audioHealth = "unavailable"; audioFailureCount += 1; return null;
      }
    }
    if (context.state && context.state !== "running") {
      releaseAudioContext(context, { close: true }); audioHealth = "unavailable"; audioFailureCount += 1; return null;
    }
    audioHealth = "ready"; return context;
  }

  async function preview(name, value) {
    if (name !== "sound" && config.values.sound === false) return false;
    const profile = name === "weather" ? { ...toneProfiles.weather, frequency: toneProfiles.weather?.[value] ?? toneProfiles.weather?.clear } : toneProfiles[name];
    if (!profile) return false;
    const context = await readyAudioContext(); if (!context) return false;
    const frequencies = profile.frequencies ?? [profile.frequency]; const scheduled = [];
    try {
      const now = context.currentTime;
      for (const frequency of frequencies) {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillator.type = "sine"; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(profile.volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration);
        oscillator.connect(gain).connect(context.destination); scheduled.push(oscillator);
      }
      for (const oscillator of scheduled) { oscillator.start(now); oscillator.stop(now + profile.duration); }
      previewCount += 1; return true;
    } catch {
      for (const oscillator of scheduled) { try { oscillator.stop?.(); oscillator.disconnect?.(); } catch { /* best-effort partial-cue cleanup */ } }
      releaseAudioContext(context, { close: true }); audioHealth = "unavailable"; audioFailureCount += 1; return false;
    }
  }

  function updateButtons(name, value) {
    for (const button of document?.querySelectorAll?.(selectorFor(name)) ?? []) button.classList?.toggle?.("active", button.dataset?.[name] === value);
    if (name === "sound") {
      const button = document?.getElementById?.("soundButton");
      button?.classList?.toggle?.("muted", !value); button?.setAttribute?.("aria-label", value ? "Tắt âm thanh" : "Bật âm thanh");
    }
  }

  function set(name, value, { persist = true, playPreview = true } = {}) {
    if (disposed) return false;
    if (name === "sound") value = Boolean(value);
    else if (!config.allowed[name]?.includes?.(value)) return false;
    config.apply[name]?.(frozenCopy({ name, value, source: "user-preference" }));
    config = Object.freeze({ ...config, values: Object.freeze({ ...config.values, [name]: value }) });
    if (persist && name !== "sound") save(name, value);
    updateButtons(name, value); if (playPreview && (name !== "sound" || value)) void preview(name, value);
    return true;
  }

  function configure({ values = {}, allowed = {}, apply = {} } = {}) {
    if (disposed) return false;
    const nextAllowed = Object.freeze(Object.fromEntries(Object.entries(allowed).map(([name, options]) => [name, Object.freeze([...options])])));
    config = Object.freeze({ values: Object.freeze({ ...values }), allowed: nextAllowed, apply: Object.freeze({ ...apply }) });
    for (const [name, value] of Object.entries(config.values)) updateButtons(name, value);
    return true;
  }

  function listen(node, type, listener) { node?.addEventListener?.(type, listener); if (node) listeners.push([node, type, listener]); }
  function attach() {
    if (disposed) return false; if (attached) return false;
    const owner = OWNERS.get(target); if (owner && owner !== api) throw new Error("browser settings owner already attached");
    OWNERS.set(target, api);
    for (const name of ["pitch", "ball", "weather"]) for (const button of document?.querySelectorAll?.(selectorFor(name)) ?? []) listen(button, "click", () => set(name, button.dataset?.[name]));
    const soundButton = document?.getElementById?.("soundButton"); listen(soundButton, "click", () => set("sound", !config.values.sound, { persist: false }));
    attached = true; return true;
  }

  function reset() { if (disposed) return false; for (const [name, value] of Object.entries(config.values)) updateButtons(name, value); return true; }
  function teardown() {
    if (disposed) return false;
    for (const [node, type, listener] of listeners.splice(0).reverse()) node.removeEventListener?.(type, listener);
    if (OWNERS.get(target) === api) OWNERS.delete(target);
    releaseAudioContext(audioContext, { close: true }); audioHealth = "disposed"; attached = false; disposed = true; return true;
  }
  function diagnostics() { return Object.freeze({ owner: "browser-settings", attached, disposed, previewCount, audioFailureCount, audioHealth, audioState: audioContext?.state ?? null, values: frozenCopy(config.values), controlBindings: frozenCopy(controlBindings), audioAvailable: Boolean(target?.AudioContext ?? target?.webkitAudioContext) }); }

  const api = Object.freeze({ attach, configure, set, preview, reset, teardown, diagnostics });
  return api;
}
