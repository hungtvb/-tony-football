import { FixedClock } from "./FixedClock.js";

export function createSimulationLoop({
  update,
  render,
  clockOptions,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
} = {}) {
  if (typeof update !== "function") throw new TypeError("update must be a function");
  if (typeof render !== "function") throw new TypeError("render must be a function");
  if (typeof requestFrame !== "function") throw new TypeError("requestFrame must be a function");

  const clock = new FixedClock(clockOptions);
  let frameHandle = null;
  let running = false;

  function frame(nowMilliseconds) {
    if (!running) return;

    const result = clock.advance(nowMilliseconds / 1000, update);
    render(result.alpha, nowMilliseconds, result);
    frameHandle = requestFrame(frame);
  }

  return {
    clock,

    start() {
      if (running) return;
      running = true;
      clock.reset(null);
      frameHandle = requestFrame(frame);
    },

    stop() {
      running = false;
      if (frameHandle !== null && typeof cancelFrame === "function") cancelFrame(frameHandle);
      frameHandle = null;
    },

    reset(nowMilliseconds = null) {
      clock.reset(nowMilliseconds === null ? null : nowMilliseconds / 1000);
    },

    get running() {
      return running;
    },
  };
}
