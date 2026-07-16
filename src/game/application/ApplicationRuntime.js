import {
  GameCommandSource,
  GameCommandType,
  createGameCommand
} from "../engine/GameCommands.js";
import { ApplicationActionType, createApplicationAction } from "./ApplicationActions.js";

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
  #sequence = 0;

  constructor({
    dispatchGameCommand,
    onNavigation = () => {},
    getMatchState = () => "menu"
  }) {
    if (typeof dispatchGameCommand !== "function") {
      throw new TypeError("ApplicationRuntime requires dispatchGameCommand");
    }
    this.#dispatchGameCommand = dispatchGameCommand;
    this.#onNavigation = onNavigation;
    this.#getMatchState = getMatchState;
  }

  request(type, payload = {}) {
    const action = createApplicationAction(type, payload);
    let resolvedType = action.type;
    if (resolvedType === ApplicationActionType.TOGGLE_PAUSE) {
      const state = this.#getMatchState();
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
      this.#dispatchGameCommand(command);
      return action;
    }

    this.#onNavigation(action);
    return action;
  }
}
