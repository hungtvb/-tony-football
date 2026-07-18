import { ApplicationActionType } from "./ApplicationActions.js";
import { ApplicationRuntime } from "./ApplicationRuntime.js";
import { BrowserApplicationAdapter } from "./BrowserApplicationAdapter.js";
import { BrowserInputAdapter } from "../input/BrowserInputAdapter.js";
import { BrowserPresentationComposition } from "../presentation/BrowserPresentationComposition.js";

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

function assertPresentationComposition(composition) {
  if (
    !composition
    || typeof composition.start !== "function"
    || typeof composition.reset !== "function"
    || typeof composition.teardown !== "function"
  ) {
    throw new TypeError("Browser bootstrap requires a presentation composition");
  }
}

export class BrowserBootstrapComposition {
  #target;
  #document;
  #runtimeComposition;
  #simulationLoop;
  #snapshotAdapter;
  #presentationComposition;
  #applicationRuntime;
  #inputAdapter;
  #applicationAdapter;
  #started = false;

  constructor({
    target,
    document,
    runtimeComposition,
    simulationLoop,
    snapshotAdapter,
    presentationComposition = null,
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
    this.#document = document;
    this.#runtimeComposition = runtimeComposition;
    this.#simulationLoop = simulationLoop;
    this.#snapshotAdapter = snapshotAdapter;
    this.#presentationComposition = presentationComposition ?? new BrowserPresentationComposition({
      adapterFactories: [() => createPresentationFeedback()],
    });
    assertPresentationComposition(this.#presentationComposition);
    this.#applicationRuntime = new ApplicationRuntime({
      onNavigation,
      getMatchState: getCompatibilityMatchState,
      runtimeComposition,
      resetRuntime: () => this.reset(),
    });
    this.#inputAdapter = new BrowserInputAdapter({
      target,
      onCommand: () => false,
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

  get presentationComposition() {
    return this.#presentationComposition;
  }

  start() {
    if (this.#started) return false;
    this.#runtimeComposition.attachTarget(this.#target);
    try {
      this.#inputAdapter.attach();
      this.#applicationAdapter.attach();
      this.#presentationComposition.start({
        target: this.#target,
        document: this.#document,
        runtimeComposition: this.#runtimeComposition,
        snapshotAdapter: this.#snapshotAdapter,
      });
      this.#simulationLoop.start();
      this.#started = true;
      return true;
    } catch (error) {
      this.#simulationLoop.stop();
      this.#presentationComposition.teardown();
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
    this.#presentationComposition.reset({
      runtimeComposition: this.#runtimeComposition,
      snapshotAdapter: this.#snapshotAdapter,
    });
    this.#simulationLoop.reset(nowMilliseconds);
  }

  teardown() {
    if (!this.#started) return false;
    this.#simulationLoop.stop();
    this.#applicationAdapter.detach();
    this.#inputAdapter.detach();
    this.#presentationComposition.teardown();
    this.#snapshotAdapter.reset?.();
    this.#runtimeComposition.teardown();
    this.#started = false;
    return true;
  }
}
