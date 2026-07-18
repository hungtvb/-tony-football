import { ApplicationActionType } from "./ApplicationActions.js";
import { ApplicationRuntime } from "./ApplicationRuntime.js";
import { BrowserApplicationAdapter } from "./BrowserApplicationAdapter.js";
import { BrowserInputAdapter } from "../input/BrowserInputAdapter.js";

function assertSimulationLoop(loop) {
  if (
    !loop
    || typeof loop.start !== "function"
    || typeof loop.stop !== "function"
    || typeof loop.reset !== "function"
  ) {
    throw new TypeError("Browser bootstrap requires a simulation loop");
  }
}

function disposePresentationFeedback(service) {
  if (!service) return;
  if (typeof service.unsubscribe === "function") service.unsubscribe();
  else if (typeof service.detach === "function") service.detach();
}

export class BrowserBootstrapComposition {
  #target;
  #runtimeComposition;
  #simulationLoop;
  #snapshotAdapter;
  #applicationRuntime;
  #inputAdapter;
  #applicationAdapter;
  #createPresentationFeedback;
  #presentationFeedback = null;
  #started = false;

  constructor({
    target,
    document,
    runtimeComposition,
    simulationLoop,
    snapshotAdapter,
    onNavigation = () => {},
    onCameraCycle = () => {},
    getCompatibilityControlMode = () => "attack",
    getCompatibilityMatchState = () => "menu",
    createPresentationFeedback = () => null,
  }) {
    if (!target || typeof target.addEventListener !== "function") {
      throw new TypeError("Browser bootstrap requires an event target");
    }
    if (!document || typeof document.getElementById !== "function") {
      throw new TypeError("Browser bootstrap requires a document");
    }
    if (
      !runtimeComposition
      || typeof runtimeComposition.attachTarget !== "function"
      || typeof runtimeComposition.teardown !== "function"
    ) {
      throw new TypeError("Browser bootstrap requires a runtime composition");
    }
    assertSimulationLoop(simulationLoop);
    if (!snapshotAdapter || typeof snapshotAdapter.capture !== "function") {
      throw new TypeError("Browser bootstrap requires a snapshot adapter");
    }
    if (typeof createPresentationFeedback !== "function") {
      throw new TypeError("createPresentationFeedback must be a function");
    }

    this.#target = target;
    this.#runtimeComposition = runtimeComposition;
    this.#simulationLoop = simulationLoop;
    this.#snapshotAdapter = snapshotAdapter;
    this.#createPresentationFeedback = createPresentationFeedback;
    this.#applicationRuntime = new ApplicationRuntime({
      onNavigation,
      getMatchState: getCompatibilityMatchState,
      runtimeComposition,
      resetRuntime: () => this.reset(),
    });
    this.#inputAdapter = new BrowserInputAdapter({
      target,
      onCommand: () => {
        throw new Error("browser input cannot dispatch compatibility gameplay commands");
      },
      onApplicationRequest: (type) => this.#applicationRuntime.request(type),
      onCameraCycle,
      getControlMode: getCompatibilityControlMode,
      getMatchState: getCompatibilityMatchState,
      runtimeComposition,
    });
    this.#applicationAdapter = new BrowserApplicationAdapter({
      target,
      document,
      runtime: this.#applicationRuntime,
      runtimeComposition,
    });
  }

  get started() {
    return this.#started;
  }

  get runtimeComposition() {
    return this.#runtimeComposition;
  }

  get snapshotAdapter() {
    return this.#snapshotAdapter;
  }

  get inputAdapter() {
    return this.#inputAdapter;
  }

  get applicationRuntime() {
    return this.#applicationRuntime;
  }

  start() {
    if (this.#started) return false;
    this.#runtimeComposition.attachTarget(this.#target);
    try {
      this.#inputAdapter.attach();
      this.#applicationAdapter.attach();
      this.#presentationFeedback = this.#createPresentationFeedback();
      this.#simulationLoop.start();
      this.#started = true;
      return true;
    } catch (error) {
      this.#simulationLoop.stop();
      disposePresentationFeedback(this.#presentationFeedback);
      this.#presentationFeedback = null;
      this.#applicationAdapter.detach();
      this.#inputAdapter.detach();
      this.#runtimeComposition.teardown();
      throw error;
    }
  }

  request(type, payload = {}) {
    return this.#applicationRuntime.request(type, payload);
  }

  pause() {
    return this.request(ApplicationActionType.PAUSE_MATCH);
  }

  resume() {
    return this.request(ApplicationActionType.RESUME_MATCH);
  }

  reset(nowMilliseconds = null) {
    this.#inputAdapter.reset({ requestPause: false });
    this.#runtimeComposition.reset();
    this.#snapshotAdapter.reset?.();
    this.#simulationLoop.reset(nowMilliseconds);
  }

  teardown() {
    if (!this.#started) return false;
    this.#simulationLoop.stop();
    this.#applicationAdapter.detach();
    this.#inputAdapter.detach();
    disposePresentationFeedback(this.#presentationFeedback);
    this.#presentationFeedback = null;
    this.#snapshotAdapter.reset?.();
    this.#runtimeComposition.teardown();
    this.#started = false;
    return true;
  }
}
