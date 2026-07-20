import { ApplicationActionType } from "./ApplicationActions.js";
import { ApplicationRuntime } from "./ApplicationRuntime.js";
import { BrowserApplicationAdapter } from "./BrowserApplicationAdapter.js";
import { BrowserInputAdapter } from "../input/BrowserInputAdapter.js";
import { BrowserPresentationComposition } from "../presentation/BrowserPresentationComposition.js";
import { createDomHudAdapter } from "../presentation/DomHudAdapter.js";
import { createRadarSnapshotAdapter } from "../presentation/RadarSnapshotAdapter.js";

function assertSimulationLoop(loop) {
  if (!loop || typeof loop.start !== "function" || typeof loop.stop !== "function" || typeof loop.reset !== "function") {
    throw new TypeError("Browser bootstrap requires a simulation loop");
  }
}

function assertPresentationComposition(composition) {
  if (!composition || typeof composition.start !== "function" || typeof composition.render !== "function" || typeof composition.reset !== "function" || typeof composition.teardown !== "function") {
    throw new TypeError("Browser bootstrap requires a presentation composition");
  }
}

function assertPresentationAdapterFactories(factories) {
  if (!Array.isArray(factories) || factories.some((factory) => typeof factory !== "function")) {
    throw new TypeError("presentationAdapterFactories must be an array of functions");
  }
}

function collectLifecycleErrors(steps) {
  const errors = [];
  for (const step of steps) {
    try { step(); } catch (error) { errors.push(error); }
  }
  return errors;
}

function throwLifecycleErrors(errors, message, primaryError = null) {
  if (errors.length === 0) {
    if (primaryError) throw primaryError;
    return;
  }
  if (!primaryError && errors.length === 1) throw errors[0];
  throw new AggregateError(primaryError ? [primaryError, ...errors] : errors, message, primaryError ? { cause: primaryError } : undefined);
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
  #onPresentationReady;
  #unsubscribeAfterRender = null;
  #started = false;

  constructor({
    target,
    document,
    runtimeComposition,
    simulationLoop,
    snapshotAdapter,
    presentationComposition = null,
    presentationAdapterFactories = null,
    onNavigation = () => {},
    onCameraCycle = () => {},
    getCompatibilityControlMode = () => "attack",
    getCompatibilityMatchState = () => "menu",
    createPresentationFeedback = () => null,
    onPresentationReady = () => {},
  }) {
    if (!target || typeof target.addEventListener !== "function") throw new TypeError("Browser bootstrap requires an event target");
    if (!document || typeof document.getElementById !== "function") throw new TypeError("Browser bootstrap requires a document");
    if (!runtimeComposition || typeof runtimeComposition.attachTarget !== "function" || typeof runtimeComposition.teardown !== "function") throw new TypeError("Browser bootstrap requires a runtime composition");
    assertSimulationLoop(simulationLoop);
    if (!snapshotAdapter || typeof snapshotAdapter.capture !== "function") throw new TypeError("Browser bootstrap requires a snapshot adapter");
    if (typeof createPresentationFeedback !== "function") throw new TypeError("createPresentationFeedback must be a function");
    if (typeof onPresentationReady !== "function") throw new TypeError("onPresentationReady must be a function");
    const resolvedPresentationAdapterFactories = presentationAdapterFactories ?? target?.__TONY_PRESENTATION_ADAPTER_FACTORIES__ ?? [];
    assertPresentationAdapterFactories(resolvedPresentationAdapterFactories);

    this.#target = target;
    this.#document = document;
    this.#runtimeComposition = runtimeComposition;
    this.#simulationLoop = simulationLoop;
    this.#snapshotAdapter = snapshotAdapter;
    this.#presentationComposition = presentationComposition ?? new BrowserPresentationComposition({
      adapterFactories: [
        ...resolvedPresentationAdapterFactories,
        ({ document: browserDocument }) => createDomHudAdapter({ document: browserDocument }),
        ({ document: browserDocument }) => createRadarSnapshotAdapter({ document: browserDocument }),
        () => createPresentationFeedback(),
      ],
    });
    assertPresentationComposition(this.#presentationComposition);
    this.#applicationRuntime = new ApplicationRuntime({ onNavigation, getMatchState: getCompatibilityMatchState, runtimeComposition, resetRuntime: () => this.reset() });
    this.#inputAdapter = new BrowserInputAdapter({ target, onCommand: () => false, onApplicationRequest: (type) => this.#applicationRuntime.request(type), onCameraCycle, getControlMode: getCompatibilityControlMode, getMatchState: getCompatibilityMatchState, runtimeComposition });
    this.#applicationAdapter = new BrowserApplicationAdapter({ target, document, runtime: this.#applicationRuntime, runtimeComposition });
    this.#onPresentationReady = onPresentationReady;
  }

  get started() { return this.#started; }
  get runtimeComposition() { return this.#runtimeComposition; }
  get snapshotAdapter() { return this.#snapshotAdapter; }
  get inputAdapter() { return this.#inputAdapter; }
  get applicationRuntime() { return this.#applicationRuntime; }
  get presentationComposition() { return this.#presentationComposition; }

  #presentationLifecycleContext() {
    return Object.freeze({ target: this.#target, document: this.#document });
  }

  start() {
    if (this.#started) return false;
    try {
      this.#runtimeComposition.attachTarget(this.#target);
      this.#inputAdapter.attach();
      this.#applicationAdapter.attach();
      this.#presentationComposition.start(this.#presentationLifecycleContext());
      this.#onPresentationReady(this.#presentationLifecycleContext());
      if (typeof this.#simulationLoop.subscribeAfterRender === "function") {
        this.#unsubscribeAfterRender = this.#simulationLoop.subscribeAfterRender((timing) => this.#renderPresentation(timing));
      }
      this.#simulationLoop.start();
      this.#started = true;
      return true;
    } catch (error) {
      const unsubscribe = this.#unsubscribeAfterRender;
      this.#unsubscribeAfterRender = null;
      const cleanupErrors = collectLifecycleErrors([
        () => this.#simulationLoop.stop(),
        () => unsubscribe?.(),
        () => this.#presentationComposition.teardown(),
        () => this.#applicationAdapter.detach(),
        () => this.#inputAdapter.detach(),
        () => this.#runtimeComposition.teardown(),
      ]);
      this.#started = false;
      throwLifecycleErrors(cleanupErrors, "browser bootstrap startup failed and cleanup reported errors", error);
    }
  }

  request(type, payload = {}) { return this.#applicationRuntime.request(type, payload); }
  pause() { return this.request(ApplicationActionType.PAUSE_MATCH); }
  resume() { return this.request(ApplicationActionType.RESUME_MATCH); }

  reset(nowMilliseconds = null) {
    const errors = collectLifecycleErrors([
      () => this.#inputAdapter.reset({ requestPause: false }),
      () => this.#runtimeComposition.reset(),
      () => this.#snapshotAdapter.reset?.(),
      () => this.#simulationLoop.reset(nowMilliseconds),
      () => this.#presentationComposition.reset(this.#presentationLifecycleContext()),
    ]);
    throwLifecycleErrors(errors, "browser bootstrap reset failed");
    return true;
  }

  teardown() {
    if (!this.#started) return false;
    const unsubscribe = this.#unsubscribeAfterRender;
    this.#unsubscribeAfterRender = null;
    this.#started = false;
    const errors = collectLifecycleErrors([
      () => this.#simulationLoop.stop(),
      () => unsubscribe?.(),
      () => this.#presentationComposition.teardown(),
      () => this.#applicationAdapter.detach(),
      () => this.#inputAdapter.detach(),
      () => this.#snapshotAdapter.reset?.(),
      () => this.#runtimeComposition.teardown(),
    ]);
    throwLifecycleErrors(errors, "browser bootstrap teardown failed");
    return true;
  }

  #renderPresentation(timing) {
    const snapshotFrame = typeof this.#snapshotAdapter.createRenderFrame === "function" ? this.#snapshotAdapter.createRenderFrame(timing.alpha) : null;
    const snapshot = snapshotFrame?.current ?? this.#snapshotAdapter.snapshot ?? null;
    if (!snapshot) return false;
    const activeCharge = this.#inputAdapter.activeCharge;
    const frame = Object.freeze({
      snapshot,
      previousSnapshot: snapshotFrame?.previous ?? snapshot,
      alpha: timing.alpha,
      nowMilliseconds: timing.nowMilliseconds,
      controlMode: this.#runtimeComposition.controlMode,
      hasActiveInput: Boolean(activeCharge || this.#inputAdapter.pressedCodes?.length),
      activeCharge,
      pressedCodes: this.#inputAdapter.pressedCodes,
    });
    return this.#presentationComposition.render(frame);
  }
}
