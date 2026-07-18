import {
  GameCommandSource,
  GameCommandType,
  createGameCommand
} from "../engine/GameCommands.js";
import { ApplicationActionType, createApplicationAction } from "./ApplicationActions.js";
import { browserRuntimeComposition } from "./BrowserRuntimeComposition.js";

const gameCommandByAction = Object.freeze({
  [ApplicationActionType.START_MATCH]: GameCommandType.START_MATCH,
  [ApplicationActionType.PAUSE_MATCH]: GameCommandType.PAUSE_MATCH,
  [ApplicationActionType.RESUME_MATCH]: GameCommandType.RESUME_MATCH,
  [ApplicationActionType.RESTART_MATCH]: GameCommandType.RESTART_MATCH
});

export class ApplicationRuntime {
  #onNavigation;
  #runtimeComposition;
  #resetRuntime;
  #sequence = 0;

  constructor({
    onNavigation = () => {},
    runtimeComposition = browserRuntimeComposition,
    resetRuntime = null,
  } = {}) {
    if (!runtimeComposition || typeof runtimeComposition.dispatch !== "function") {
      throw new TypeError("ApplicationRuntime requires a runtime composition");
    }
    if (resetRuntime !== null && typeof resetRuntime !== "function") {
      throw new TypeError("resetRuntime must be a function");
    }
    this.#onNavigation = onNavigation;
    this.#runtimeComposition = runtimeComposition;
    this.#resetRuntime = resetRuntime ?? (() => this.#runtimeComposition.reset());
  }

  request(type, payload = {}) {
    const action = createApplicationAction(type, payload);
    let resolvedType = action.type;
    if (resolvedType === ApplicationActionType.TOGGLE_PAUSE) {
      const state = this.#runtimeComposition.state;
      if (state !== "playing" && state !== "paused") return action;
      resolvedType = state === "playing"
        ? ApplicationActionType.PAUSE_MATCH
        : ApplicationActionType.RESUME_MATCH;
    }

    const gameCommandType = gameCommandByAction[resolvedType];
    if (gameCommandType) {
      const command = createGameCommand(gameCommandType, {}, {
        source: GameCommandSource.APPLICATION,
        sequence: this.#sequence
      });
      this.#sequence += 1;
      if (!this.#runtimeComposition.dispatch(command)) {
        throw new Error("browser lifecycle commands require live engine authority");
      }
      return action;
    }

    this.#resetRuntime(action);
    this.#onNavigation(action);
    return action;
  }
}