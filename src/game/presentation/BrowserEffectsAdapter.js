import { createContextualParticlePolicy } from "./ContextualParticlePolicy.js";
import { createGameFeelController } from "./GameFeelController.js";

const OWNERS = new WeakMap();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const copyPoint = (point) => Object.freeze({ x: Number(point?.x ?? 0), y: Number(point?.y ?? 0), height: Number(point?.height ?? 0) });

export function createBrowserEffectsAdapter({ target, lowPowerDevice = false, reducedMotion = false, random = Math.random } = {}) {
  if (!target || typeof target !== "object") throw new TypeError("BrowserEffectsAdapter requires a target");
  const feel = createGameFeelController({ lowPowerDevice, reducedMotion });
  const contextual = createContextualParticlePolicy({ lowPowerDevice, reducedMotion });
  let particles = []; let trail = []; let enabled = true; let attached = false; let disposed = false; let projectionSequence = 0; let cachedSnapshot = null;

  function attach() {
    if (disposed || attached) return false;
    const owner = OWNERS.get(target); if (owner && owner !== api) throw new Error("browser effects owner already attached");
    OWNERS.set(target, api); attached = true; return true;
  }
  function emitParticle({ x = 0, y = 0, color = "#f4f7f5", energy = 1 } = {}) {
    if (!attached || disposed || !enabled || particles.length >= feel.particleBudget()) return false;
    const angle = random() * Math.PI * 2; const speed = random() * 150 * clamp(Number(energy) || 0, 0, 4);
    particles.push({ x: Number(x) || 0, y: Number(y) || 0, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.4 + random() * 0.7, max: 1.1, color: String(color), size: 2 + random() * 4 }); cachedSnapshot = null;
    return true;
  }
  function emitParticles({ particleCount = 0, particleColor = "#f4f7f5", particleEnergy = 1, ...position } = {}) {
    let emitted = 0; for (let index = 0; index < Math.max(0, Math.floor(particleCount)); index += 1) if (emitParticle({ ...position, color: particleColor, energy: particleEnergy })) emitted += 1;
    return emitted;
  }
  function emitContextParticles({ x = 0, y = 0, contextX = x, contextY = y, contextEnergy = 1, weather = "clear", pitchStyle = "classic" } = {}) {
    if (!enabled) return 0; const burst = contextual.burst({ energy: contextEnergy, weather, pitchStyle }); let emitted = 0;
    for (let index = 0; index < burst.count; index += 1) if (emitParticle({ x: contextX, y: contextY, color: burst.colors[index % burst.colors.length], energy: burst.energy })) emitted += 1;
    return emitted;
  }
  function update(dt) {
    if (!attached || disposed) return false; const delta = clamp(Number(dt) || 0, 0, 0.25);
    for (const particle of particles) { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 90 * delta; particle.vx *= Math.pow(0.4, delta); particle.life -= delta; }
    particles = particles.filter((particle) => particle.life > 0); projectionSequence += 1; cachedSnapshot = null; return true;
  }
  function recordTrail(point, { speed = 0 } = {}) {
    if (!attached || disposed || !enabled) return Object.freeze([]);
    trail = [copyPoint(point), ...trail].slice(0, feel.trailPointCount(speed)); projectionSequence += 1; cachedSnapshot = null;
    return Object.freeze([...trail]);
  }
  function projectTrail(points = [], { speed = 0 } = {}) {
    if (!enabled || disposed) return Object.freeze([]);
    const count = Math.min(feel.trailPointCount(speed), points.length);
    return Object.freeze(points.slice(0, count).map((point, index) => Object.freeze({ ...copyPoint(point), opacity: feel.trailOpacity(index, count, speed) })));
  }
  function projectCharge({ active = false, power = 0, player = null } = {}) {
    if (!enabled || disposed || !active || !player) return Object.freeze({ active: false, power: 0, player: null, color: "#ffcf58" });
    return Object.freeze({ active: true, power: clamp(Number(power) || 0, 0, 1), player: copyPoint(player), color: power > 0.82 ? "#ff5b45" : "#ffcf58" });
  }
  function snapshot() { cachedSnapshot ??= Object.freeze({ projectionSequence, particles: Object.freeze(particles.map((particle) => Object.freeze({ ...particle }))), enabled }); return cachedSnapshot; }
  function setEnabled(value) { if (disposed) return false; enabled = Boolean(value); if (!enabled) particles = []; projectionSequence += 1; cachedSnapshot = null; return true; }
  function reset() { if (disposed) return false; particles = []; trail = []; feel.clear(); projectionSequence = 0; cachedSnapshot = null; return true; }
  function teardown() { if (disposed) return false; reset(); if (OWNERS.get(target) === api) OWNERS.delete(target); attached = false; disposed = true; return true; }
  function diagnostics() { return Object.freeze({ owner: "browser-effects", attached, disposed, enabled, particleCount: particles.length, trailPointCount: trail.length, trailCapacity: feel.trailPointCount(Number.POSITIVE_INFINITY), projectionSequence, budget: feel.particleBudget() }); }
  const api = Object.freeze({ attach, emitParticles, emitContextParticles, update, recordTrail, projectTrail, projectCharge, snapshot, setEnabled, reset, teardown, diagnostics });
  return api;
}
