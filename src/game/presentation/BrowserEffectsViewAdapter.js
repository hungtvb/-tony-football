import * as THREE from "three";
import { createBallTrail3D } from "./BallTrail3D.js";

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}

function worldX(value) { return (Number(value) - 600) * 0.1; }
function worldZ(value) { return (Number(value) - 350) * 0.1; }

export function createBrowserEffectsViewAdapter({ document, getScenePort, budget = 180, trailCapacity = 26 } = {}) {
  if (!document || typeof document.createElement !== "function") throw new TypeError("BrowserEffectsViewAdapter requires a document");
  assertFunction(getScenePort, "getScenePort");
  let port = null; let particles = null; let trail = null; let screen = null; let attached = false; let disposed = false; let renderCount = 0; let projectionSequence = 0;

  function releaseObjects() {
    if (port && particles) port.removeObject(particles);
    if (port && trail?.line) port.removeObject(trail.line);
    particles?.geometry?.dispose?.(); particles?.material?.dispose?.(); trail?.dispose?.();
    particles = null; trail = null; port = null;
  }

  function bindScene() {
    const nextPort = getScenePort();
    if (!nextPort || nextPort === port) return Boolean(port);
    releaseObjects(); port = nextPort;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(budget * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(budget * 3), 3));
    particles = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .42, vertexColors: true, transparent: true, opacity: .88, depthWrite: false }));
    trail = createBallTrail3D(THREE, { maxPoints: trailCapacity });
    port.addObject(particles); port.addObject(trail.line); return true;
  }

  function ensureScreen() {
    if (screen) return screen;
    const canvas = document.getElementById?.("gameCanvas");
    const host = canvas?.parentElement;
    if (!host) return null;
    screen = host.querySelector?.(".screen-fx") ?? document.createElement("div");
    if (!screen.classList?.contains?.("screen-fx")) {
      screen.className = "screen-fx"; screen.innerHTML = "<span>GOAL!</span>"; host.appendChild?.(screen);
    }
    return screen;
  }

  function render(frame = {}) {
    if (!attached || disposed || !frame.effects || !Object.isFrozen(frame.effects)) return false;
    const effectFacts = frame.effects; bindScene();
    if (particles) {
      const positions = particles.geometry.attributes.position.array; const colors = particles.geometry.attributes.color.array;
      const count = Math.min(budget, effectFacts.particles.length);
      for (let index = 0; index < count; index += 1) {
        const fact = effectFacts.particles[index]; const offset = index * 3; const color = new THREE.Color(fact.color);
        positions[offset] = worldX(fact.x); positions[offset + 1] = .35 + Math.max(0, fact.max - fact.life) * 1.8; positions[offset + 2] = worldZ(fact.y);
        colors[offset] = color.r; colors[offset + 1] = color.g; colors[offset + 2] = color.b;
      }
      particles.geometry.setDrawRange(0, count); particles.geometry.attributes.position.needsUpdate = true; particles.geometry.attributes.color.needsUpdate = true;
    }
    trail?.update?.(effectFacts.trail, { worldX, worldZ, speed: effectFacts.speed, opacityForIndex: (index) => effectFacts.trail[index]?.opacity ?? 0 });
    const overlay = ensureScreen(); const goalSequence = frame.snapshot?.match?.goalSequence;
    if (overlay) { overlay.style.opacity = goalSequence ? "1" : "0"; overlay.classList?.toggle?.("active", Boolean(goalSequence)); }
    projectionSequence = effectFacts.projectionSequence; renderCount += 1; port?.requestRender?.(); return true;
  }

  return Object.freeze({
    attach() { if (attached || disposed) return false; attached = true; ensureScreen(); bindScene(); return true; },
    render,
    reset() { if (!attached || disposed) return false; projectionSequence = 0; renderCount = 0; if (screen) { screen.style.opacity = "0"; screen.classList?.remove?.("active"); } return true; },
    teardown() { if (!attached || disposed) return false; releaseObjects(); screen?.remove?.(); screen = null; attached = false; disposed = true; return true; },
    diagnostics: () => Object.freeze({ owner: "browser-effects-view", attached, disposed, renderCount, projectionSequence, sceneBound: Boolean(port) }),
  });
}
