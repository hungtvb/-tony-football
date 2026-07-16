import { ApplicationActionType, createApplicationAction } from "./ApplicationActions.js";
import { browserRuntimeComposition } from "./BrowserRuntimeComposition.js";

export const APPLICATION_REQUEST_EVENT = "tony:application-request";
export const APPLICATION_HANDLED_EVENT = "tony:application-handled";

const defaultButtonActions = Object.freeze({
  playButton: ApplicationActionType.START_MATCH,
  pauseButton: ApplicationActionType.TOGGLE_PAUSE,
  resumeButton: ApplicationActionType.RESUME_MATCH,
  restartButton: ApplicationActionType.RESTART_MATCH,
  setupButton: ApplicationActionType.OPEN_MATCH_SETUP,
  mainMenuButton: ApplicationActionType.OPEN_MAIN_MENU,
  playAgainButton: ApplicationActionType.RESTART_MATCH,
  quickMatchButton: ApplicationActionType.OPEN_MATCH_SETUP,
  setupBackButton: ApplicationActionType.OPEN_MAIN_MENU
});

export function requestApplicationAction(target, type, payload = {}) {
  const action = createApplicationAction(type, payload);
  target.dispatchEvent(new CustomEvent(APPLICATION_REQUEST_EVENT, { detail: action }));
  return action;
}

export class BrowserApplicationAdapter {
  #target;
  #document;
  #runtime;
  #runtimeComposition;
  #buttonActions;
  #buttonHandlers = new Map();
  #attached = false;

  constructor({
    target,
    document,
    runtime,
    buttonActions = defaultButtonActions,
    runtimeComposition = browserRuntimeComposition
  }) {
    if (!target || typeof target.addEventListener !== "function") throw new TypeError("target must be an event target");
    if (!document || typeof document.getElementById !== "function") throw new TypeError("document is required");
    if (!runtime || typeof runtime.request !== "function") throw new TypeError("runtime is required");
    this.#target = target;
    this.#document = document;
    this.#runtime = runtime;
    this.#runtimeComposition = runtimeComposition;
    this.#buttonActions = buttonActions;
    if (runtimeComposition.authoritative) runtimeComposition.attachTarget(target);
  }

  attach() {
    if (this.#attached) return;
    this.#target.addEventListener(APPLICATION_REQUEST_EVENT, this.#handleRequest);
    for (const [id, type] of Object.entries(this.#buttonActions)) {
      const button = this.#document.getElementById(id);
      if (!button) continue;
      const handler = () => this.#handleAction(createApplicationAction(type));
      button.addEventListener("click", handler);
      this.#buttonHandlers.set(button, handler);
    }
    this.#attached = true;
  }

  detach() {
    if (!this.#attached) return;
    this.#target.removeEventListener(APPLICATION_REQUEST_EVENT, this.#handleRequest);
    for (const [button, handler] of this.#buttonHandlers) button.removeEventListener("click", handler);
    this.#buttonHandlers.clear();
    this.#attached = false;
  }

  #projectLiveLifecycle(action) {
    if (!this.#runtimeComposition.authoritative) return;
    let type = action.type;
    if (type === ApplicationActionType.TOGGLE_PAUSE) {
      type = this.#runtimeComposition.state === "playing"
        ? ApplicationActionType.PAUSE_MATCH
        : ApplicationActionType.RESUME_MATCH;
    }

    const start = this.#document.getElementById("startOverlay");
    const pause = this.#document.getElementById("pauseOverlay");
    const result = this.#document.getElementById("resultOverlay");
    const matchState = this.#document.getElementById("matchState");

    if (type === ApplicationActionType.START_MATCH || type === ApplicationActionType.RESTART_MATCH) {
      start?.classList.remove("show");
      pause?.classList.remove("show");
      result?.classList.remove("show");
      if (matchState) matchState.textContent = "LIVE";
    } else if (type === ApplicationActionType.PAUSE_MATCH) {
      pause?.classList.add("show");
      if (matchState) matchState.textContent = "TẠM DỪNG";
    } else if (type === ApplicationActionType.RESUME_MATCH) {
      pause?.classList.remove("show");
      if (matchState) matchState.textContent = "LIVE";
    }
  }

  #handleAction(action) {
    this.#projectLiveLifecycle(action);
    this.#runtime.request(action.type, action.payload);
    this.#target.dispatchEvent(new CustomEvent(APPLICATION_HANDLED_EVENT, { detail: action }));
  }

  #handleRequest = (event) => {
    this.#handleAction(event.detail);
  };
}
