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
  #dispatchGameCommand;
  #onNavigation;
  #getMatchState;
  #runtimeComposition;
  #sequence = 0;

  constructor({
    dispatchGameCommand,
    onNavigation = () => {},
    getMatchState = () => "menu",
    runtimeComposition = browserRuntimeComposition
  }) {
    if (typeof dispatchGameCommand !== "function") {
      throw new TypeError("ApplicationRuntime requires dispatchGameCommand");
    }
    this.#dispatchGameCommand = dispatchGameCommand;
    this.#onNavigation = onNavigation;
    this.#getMatchState = getMatchState;
    this.#runtimeComposition = runtimeComposition;
  }

  request(type, payload = {}) {
    const action = createApplicationAction(type, payload);
    let resolvedType = action.type;
    if (resolvedType === ApplicationActionType.TOGGLE_PAUSE) {
      const state = this.#runtimeComposition.authoritative
        ? this.#runtimeComposition.state
        : this.#getMatchState();
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
        this.#dispatchGameCommand(command);
      }
      return action;
    }

    if (this.#runtimeComposition.authoritative) this.#runtimeComposition.reset();
    this.#onNavigation(action);
    return action;
  }
}
