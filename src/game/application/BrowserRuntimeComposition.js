import { GameCommandType } from "../engine/GameCommands.js";
import { publishGameEvent } from "../presentation/BrowserGameEventBridge.js";
import { projectBrowserMatchPresentationEvent } from "../presentation/BrowserMatchPresentationProjection.js";
import { BrowserMatchRuntime } from "./BrowserMatchRuntime.js";

export const BrowserRuntimeMode = Object.freeze({
  ENGINE: "engine",
  COMPATIBILITY: "compatibility",
});

const FIXED_STEP_SECONDS = 1 / 60;
const resetCommandTypes = new Set([
  GameCommandType.START_MATCH,
  GameCommandType.RESTART_MATCH,
]);

function hasBrowserLocation() {
  return typeof globalThis.window !== "undefined"
    && typeof globalThis.location?.search === "string";
}

export function resolveBrowserRuntimeMode(search = hasBrowserLocation() ? globalThis.location.search : null) {
  if (search === null) return BrowserRuntimeMode.COMPATIBILITY;
  const params = new URLSearchParams(search);
  const requested = params.get("runtime");
  if (requested === BrowserRuntimeMode.COMPATIBILITY) return BrowserRuntimeMode.COMPATIBILITY;
  if (requested === BrowserRuntimeMode.ENGINE) return BrowserRuntimeMode.ENGINE;
  // Debug scenarios intentionally mutate legacy fixtures. Keep them on the explicit
  // compatibility path while normal browser sessions default to the live engine.
  if (params.has("debugScenario")) return BrowserRuntimeMode.COMPATIBILITY;
  return BrowserRuntimeMode.ENGINE;
}

function playerSpec(player) {
  return {
    x: player.baseX ?? player.x,
    y: player.baseY ?? player.y,
    role: player.role,
    name: player.name,
    number: player.number,
    rating: player.rating,
  };
}

function engineOptionsFromSource(source) {
  const players = Array.isArray(source?.players) ? source.players : [];
  return {
    formations: {
      home: players.filter((player) => player.team === 0).map(playerSpec),
      away: players.filter((player) => player.team === 1).map(playerSpec),
    },
    matchSeconds: source.matchSeconds,
    difficulty: source.difficulty,
    pitchStyle: source.settings?.pitchStyle,
    ballStyle: source.settings?.ballStyle,
    weather: source.settings?.weather,
    width: source.width ?? 1200,
    height: source.height ?? 700,
  };
}

function stableOptionsKey(options) {
  return JSON.stringify(options);
}

function assertSourceTick(tick) {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError("browser runtime source tick must be a non-negative integer");
  }
}

function assertEventTarget(target) {
  if (!target || typeof target.dispatchEvent !== "function") {
    throw new TypeError("browser runtime composition requires an event target");
  }
}

function snapshotDiagnostics(snapshot) {
  if (!snapshot) return null;
  return {
    tick: snapshot.tick,
    score: [...snapshot.match.score],
    replayActive: Boolean(snapshot.match.replay?.active),
    replayElapsed: snapshot.match.replay?.elapsed ?? 0,
    replayDuration: snapshot.match.replay?.duration ?? 0,
    goalPhase: snapshot.match.goalSequence?.phase ?? null,
    goalSequence: snapshot.match.goalSequence ? { ...snapshot.match.goalSequence } : null,
    kickoffTimer: snapshot.match.kickoffTimer,
    ballOwnerId: snapshot.ball.ownerId,
    stats: {
      possession: [...snapshot.match.stats.possession],
      shots: [...snapshot.match.stats.shots],
      passes: snapshot.match.stats.passes,
      completed: snapshot.match.stats.completed,
    },
  };
}

function installLiveDiagnostics(target, getRuntimeDiagnostics) {
  let active = true;
  let installedDebug = null;
  let legacyDiagnostics = null;
  let projectedDiagnostics = null;

  const install = () => {
    if (!active) return false;
    const debug = target?.__TONY_DEBUG__;
    if (!debug || typeof debug.diagnostics !== "function") return false;
    if (debug.diagnostics === projectedDiagnostics) return true;
    if (debug.diagnostics.liveRuntimeProjection === true) return false;

    installedDebug = debug;
    legacyDiagnostics = debug.diagnostics;
    projectedDiagnostics = () => {
      const runtime = getRuntimeDiagnostics();
      return {
        ...legacyDiagnostics.call(installedDebug),
        state: runtime.state,
        runtimeMode: BrowserRuntimeMode.ENGINE,
        engineSnapshot: snapshotDiagnostics(runtime.snapshot),
      };
    };
    projectedDiagnostics.liveRuntimeProjection = true;
    debug.diagnostics = projectedDiagnostics;
    return true;
  };

  if (!install()) {
    const enqueue = typeof target?.queueMicrotask === "function"
      ? target.queueMicrotask.bind(target)
      : globalThis.queueMicrotask;
    enqueue?.(install);
  }

  return () => {
    if (!active) return false;
    active = false;
    if (installedDebug?.diagnostics === projectedDiagnostics) {
      installedDebug.diagnostics = legacyDiagnostics;
    }
    installedDebug = null;
    legacyDiagnostics = null;
    projectedDiagnostics = null;
    return true;
  };
}

export class BrowserRuntimeComposition {
  #mode;
  #stepSeconds;
  #runtimeFactory;
  #runtime = null;
  #target = null;
  #diagnosticsDisposer = null;
  #engineOptions = null;
  #optionsKey = null;
  #sourceTick = null;

  constructor({
    mode = resolveBrowserRuntimeMode(),
    stepSeconds = FIXED_STEP_SECONDS,
    runtimeFactory = (options) => new BrowserMatchRuntime(options),
  } = {}) {
    if (!Object.values(BrowserRuntimeMode).includes(mode)) {
      throw new TypeError(`Unknown browser runtime mode: ${mode}`);
    }
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError("browser runtime stepSeconds must be positive");
    }
    if (typeof runtimeFactory !== "function") {
      throw new TypeError("browser runtimeFactory must be a function");
    }
    this.#mode = mode;
    this.#stepSeconds = stepSeconds;
    this.#runtimeFactory = runtimeFactory;
  }

  get mode() {
    return this.#mode;
  }

  get authoritative() {
    return this.#mode === BrowserRuntimeMode.ENGINE;
  }

  get state() {
    return this.#runtime?.state ?? "menu";
  }

  get snapshot() {
    return this.#runtime?.snapshot ?? null;
  }

  get controlMode() {
    const snapshot = this.snapshot;
    if (!snapshot) return "defense";
    const owner = snapshot.players.find((player) => player.id === snapshot.ball.ownerId) ?? null;
    if (owner) return owner.team === 0 ? "attack" : "defense";
    return snapshot.match.controls?.lastMode ?? "defense";
  }

  attachTarget(target) {
    if (!this.authoritative) return false;
    assertEventTarget(target);
    if (this.#target === target) return true;
    if (this.#target) this.detachTarget(this.#target);
    this.#target = target;
    this.#diagnosticsDisposer = installLiveDiagnostics(
      target,
      () => ({ state: this.state, snapshot: this.snapshot }),
    );
    return true;
  }

  detachTarget(target = this.#target) {
    if (!this.authoritative || target !== this.#target) return false;
    this.#diagnosticsDisposer?.();
    this.#diagnosticsDisposer = null;
    this.#target = null;
    return true;
  }

  configure(source) {
    if (!this.authoritative) return null;
    assertSourceTick(source?.tick);
    const options = engineOptionsFromSource(source);
    const optionsKey = stableOptionsKey(options);
    const canRefreshMenuRuntime = this.#runtime?.state === "menu";
    if (!this.#runtime || (canRefreshMenuRuntime && optionsKey !== this.#optionsKey)) {
      this.#replaceRuntime(options, source.tick);
    } else {
      this.#engineOptions = options;
      this.#optionsKey = optionsKey;
      if (this.#sourceTick === null) this.#sourceTick = source.tick;
    }
    return this.snapshot;
  }

  dispatch(command) {
    if (!this.authoritative) return false;
    if (!this.#runtime) {
      throw new Error("configure the browser runtime before dispatching commands");
    }
    if (resetCommandTypes.has(command?.type)) {
      this.#replaceRuntime(this.#engineOptions, this.#sourceTick ?? 0);
    }
    this.#runtime.dispatch(command);
    return true;
  }

  advanceToSourceTick(sourceTick) {
    if (!this.authoritative) return null;
    assertSourceTick(sourceTick);
    if (!this.#runtime || this.#sourceTick === null) {
      throw new Error("configure the browser runtime before advancing it");
    }
    if (sourceTick < this.#sourceTick) {
      throw new RangeError("browser runtime source tick cannot move backwards");
    }
    const steps = sourceTick - this.#sourceTick;
    for (let index = 0; index < steps; index += 1) {
      this.#runtime.step(this.#stepSeconds);
    }
    this.#sourceTick = sourceTick;
    return this.snapshot;
  }

  createRenderFrame(alpha) {
    if (!this.authoritative || !this.#runtime) {
      throw new Error("live browser runtime is not configured");
    }
    return this.#runtime.createRenderFrame(alpha);
  }

  reset() {
    if (!this.authoritative || !this.#engineOptions) return false;
    this.#replaceRuntime(this.#engineOptions, this.#sourceTick ?? 0);
    return true;
  }

  teardown() {
    this.detachTarget();
    this.#runtime = null;
    this.#engineOptions = null;
    this.#optionsKey = null;
    this.#sourceTick = null;
    return true;
  }

  #replaceRuntime(options, sourceTick) {
    this.#engineOptions = options;
    this.#optionsKey = stableOptionsKey(options);
    this.#sourceTick = sourceTick;
    this.#runtime = this.#runtimeFactory({
      engineOptions: options,
      publishEvent: (event) => {
        if (!this.#target) return;
        projectBrowserMatchPresentationEvent(this.#target.document, event);
        publishGameEvent(this.#target, event);
      },
    });
  }
}

export const browserRuntimeComposition = new BrowserRuntimeComposition();
