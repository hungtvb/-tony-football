import { FixedClock } from "./FixedClock.js";

function assertAfterRenderListener(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("after-render listener must be a function");
  }
}

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
  const afterRenderListeners = new Set();
  let frameHandle = null;
  let running = false;

  function frame(nowMilliseconds) {
    if (!running) return;

    const result = clock.advance(nowMilliseconds / 1000, update);
    render(result.alpha, nowMilliseconds, result);
    const renderFrame = Object.freeze({
      alpha: result.alpha,
      nowMilliseconds,
      steps: result.steps,
      frameDeltaSeconds: result.frameDeltaSeconds,
      droppedSeconds: result.droppedSeconds,
    });
    for (const listener of afterRenderListeners) listener(renderFrame);
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

    subscribeAfterRender(listener) {
      assertAfterRenderListener(listener);
      afterRenderListeners.add(listener);
      return () => afterRenderListeners.delete(listener);
    },

    get running() {
      return running;
    },
  };
}
