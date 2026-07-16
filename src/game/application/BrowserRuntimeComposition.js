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

function installLiveDiagnostics(target, getState) {
  const install = () => {
    const debug = target?.__TONY_DEBUG__;
    if (!debug || typeof debug.diagnostics !== "function") return false;
    if (debug.diagnostics.liveRuntimeProjection === true) return true;
    const legacyDiagnostics = debug.diagnostics.bind(debug);
    const diagnostics = () => ({
      ...legacyDiagnostics(),
      state: getState(),
      runtimeMode: BrowserRuntimeMode.ENGINE,
    });
    diagnostics.liveRuntimeProjection = true;
    debug.diagnostics = diagnostics;
    return true;
  };

  if (install()) return;
  const enqueue = typeof target?.queueMicrotask === "function"
    ? target.queueMicrotask.bind(target)
    : globalThis.queueMicrotask;
  enqueue?.(install);
}

export class BrowserRuntimeComposition {
  #mode;
  #stepSeconds;
  #runtimeFactory;
  #runtime = null;
  #target = null;
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
    this.#target = target;
    installLiveDiagnostics(target, () => this.state);
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
