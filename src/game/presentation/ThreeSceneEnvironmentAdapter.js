export const ThreeSceneEnvironmentStatus = Object.freeze({
  IDLE: "idle",
  WEBGL: "webgl",
  FALLBACK: "fallback",
});

export const THREE_SCENE_FALLBACK_EVENT = "tony:three-scene-fallback";

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}

function createFallbackEvent(target, type, detail) {
  const EventConstructor = target?.CustomEvent ?? globalThis.CustomEvent;
  if (typeof EventConstructor === "function") return new EventConstructor(type, { detail });
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail, enumerable: true });
  return event;
}

function viewportFor(canvas, target) {
  const width = Math.max(1, Number(canvas?.clientWidth || canvas?.width || 1));
  const height = Math.max(1, Number(canvas?.clientHeight || canvas?.height || 1));
  const pixelRatio = Math.max(1, Number(target?.devicePixelRatio || 1));
  return Object.freeze({ width, height, pixelRatio });
}

function assertHost(host) {
  if (!host || typeof host !== "object") throw new TypeError("scene host factory must return an object");
  assertFunction(host.render, "scene host render");
  assertFunction(host.resize, "scene host resize");
  assertFunction(host.dispose, "scene host dispose");
  if (host.start !== undefined) assertFunction(host.start, "scene host start");
  if (host.reset !== undefined) assertFunction(host.reset, "scene host reset");
  if (host.port !== undefined && (!host.port || typeof host.port !== "object" || !Object.isFrozen(host.port))) {
    throw new TypeError("scene host port must be a frozen object");
  }
  return host;
}

function collectErrors(steps) {
  const errors = [];
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

function throwCollected(errors, message) {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, message);
}

function defaultRendererPreference(target) {
  try {
    return new URLSearchParams(target?.location?.search ?? "").get("renderer");
  } catch {
    return null;
  }
}

export function createThreeSceneEnvironmentAdapter({
  target,
  document,
  canvasId = "gameCanvas",
  createSceneHost,
  getRendererPreference = () => defaultRendererPreference(target),
  onHostChanged = () => {},
  onFallback = () => {},
  fallbackEventFactory = (detail) => createFallbackEvent(target, THREE_SCENE_FALLBACK_EVENT, detail),
} = {}) {
  if (!target || typeof target.addEventListener !== "function" || typeof target.removeEventListener !== "function") {
    throw new TypeError("ThreeSceneEnvironmentAdapter requires an event target");
  }
  if (!document || typeof document.getElementById !== "function") {
    throw new TypeError("ThreeSceneEnvironmentAdapter requires a document");
  }
  assertFunction(createSceneHost, "createSceneHost");
  assertFunction(getRendererPreference, "getRendererPreference");
  assertFunction(onHostChanged, "onHostChanged");
  assertFunction(onFallback, "onFallback");
  assertFunction(fallbackEventFactory, "fallbackEventFactory");

  let canvas = null;
  let host = null;
  let attached = false;
  let status = ThreeSceneEnvironmentStatus.IDLE;
  let fallback = null;

  function publishFallback(reason, error = null, recoverable = true) {
    fallback = Object.freeze({
      reason,
      recoverable: Boolean(recoverable),
      message: error?.message ?? (error ? String(error) : reason),
    });
    status = ThreeSceneEnvironmentStatus.FALLBACK;
    onFallback(fallback);
    target.dispatchEvent?.(fallbackEventFactory(fallback));
    return false;
  }

  function releaseHost() {
    const current = host;
    host = null;
    onHostChanged(null);
    if (!current) return [];
    return collectErrors([() => current.dispose()]);
  }

  function failHost(reason, error = null, recoverable = true) {
    const cleanupErrors = releaseHost();
    const fallbackResult = publishFallback(reason, error, recoverable);
    if (cleanupErrors.length > 0) {
      const primary = error ?? new Error(reason);
      throw new AggregateError([primary, ...cleanupErrors], "scene host failed and cleanup reported errors", { cause: primary });
    }
    return fallbackResult;
  }

  function startHost() {
    if (getRendererPreference() === "canvas") return publishFallback("forced-canvas", null, false);
    if (!canvas) return publishFallback("canvas-missing", null, false);

    let candidate = null;
    try {
      candidate = assertHost(createSceneHost(Object.freeze({
        canvas,
        target,
        document,
        viewport: viewportFor(canvas, target),
      })));
      candidate.start?.();
      candidate.resize(viewportFor(canvas, target));
      host = candidate;
      status = ThreeSceneEnvironmentStatus.WEBGL;
      fallback = null;
      onHostChanged(candidate.port ?? null);
      return true;
    } catch (error) {
      const cleanupErrors = candidate ? collectErrors([() => candidate.dispose()]) : [];
      host = null;
      onHostChanged(null);
      publishFallback("webgl-startup-failed", error, true);
      if (cleanupErrors.length > 0) {
        throw new AggregateError([error, ...cleanupErrors], "scene host startup failed and rollback reported errors", { cause: error });
      }
      return false;
    }
  }

  const handleResize = () => {
    if (!attached || status !== ThreeSceneEnvironmentStatus.WEBGL || !host) return;
    try {
      host.resize(viewportFor(canvas, target));
    } catch (error) {
      failHost("webgl-resize-failed", error, true);
    }
  };

  const handleContextLost = (event) => {
    event?.preventDefault?.();
    if (!attached) return;
    failHost("webgl-context-lost", new Error("WebGL context lost"), true);
  };

  const handleContextRestored = () => {
    if (!attached || status === ThreeSceneEnvironmentStatus.WEBGL || getRendererPreference() === "canvas") return;
    startHost();
  };

  return Object.freeze({
    get attached() {
      return attached;
    },

    get status() {
      return status;
    },

    get fallback() {
      return fallback;
    },

    get port() {
      return host?.port ?? null;
    },

    attach() {
      if (attached) return false;
      attached = true;
      canvas = document.getElementById(canvasId);
      target.addEventListener("resize", handleResize);
      canvas?.addEventListener?.("webglcontextlost", handleContextLost);
      canvas?.addEventListener?.("webglcontextrestored", handleContextRestored);
      return startHost();
    },

    render(frame) {
      if (!attached || status !== ThreeSceneEnvironmentStatus.WEBGL || !host) return false;
      try {
        const rendered = host.render(frame);
        if (rendered === false) return failHost("webgl-render-unavailable", null, true);
        return true;
      } catch (error) {
        return failHost("webgl-render-failed", error, true);
      }
    },

    reset(context = Object.freeze({})) {
      if (!attached || status !== ThreeSceneEnvironmentStatus.WEBGL || !host) return false;
      try {
        host.reset?.(context);
        return true;
      } catch (error) {
        return failHost("webgl-reset-failed", error, true);
      }
    },

    teardown() {
      if (!attached) return false;
      attached = false;
      const currentCanvas = canvas;
      canvas = null;
      const errors = collectErrors([
        () => target.removeEventListener("resize", handleResize),
        () => currentCanvas?.removeEventListener?.("webglcontextlost", handleContextLost),
        () => currentCanvas?.removeEventListener?.("webglcontextrestored", handleContextRestored),
        ...releaseHost().map((error) => () => { throw error; }),
      ]);
      status = ThreeSceneEnvironmentStatus.IDLE;
      fallback = null;
      throwCollected(errors, "ThreeSceneEnvironmentAdapter teardown failed");
      return true;
    },
  });
}
