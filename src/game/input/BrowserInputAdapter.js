import { browserRuntimeComposition } from "../application/BrowserRuntimeComposition.js";
import {
  GameCommandSource,
  GameCommandType,
  createGameCommand
} from "../engine/GameCommands.js";
import {
  FO4_ATTACK_ACTION_CODES,
  FO4_CONTROLS,
  FO4_DIRECTION_CODES,
  directionFromCode,
  movementFromPressedCodes
} from "./FO4Controls.js";

const CHARGE_DURATION_MS = 900;
const repeatedActionCodes = new Set([
  ...FO4_ATTACK_ACTION_CODES,
  FO4_CONTROLS.teammateRun,
  FO4_CONTROLS.tackle,
  FO4_CONTROLS.camera,
  "Escape"
]);
const blockedCodes = new Set([...FO4_DIRECTION_CODES, FO4_CONTROLS.tackle]);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assertEventTarget(target) {
  if (!target || typeof target.addEventListener !== "function" || typeof target.removeEventListener !== "function") {
    throw new TypeError("BrowserInputAdapter requires an event target");
  }
}

export class BrowserInputAdapter {
  #target;
  #clock;
  #onCommand;
  #onApplicationRequest;
  #onCameraCycle;
  #getControlMode;
  #getMatchState;
  #runtimeComposition;
  #pressed = new Set();
  #charge = null;
  #lastAim = Object.freeze({ x: 1, y: 0 });
  #qTapStarted = false;
  #qConsumed = false;
  #sequence = 0;
  #attached = false;

  constructor({
    target,
    clock = () => performance.now(),
    onCommand,
    onApplicationRequest = () => {},
    onCameraCycle = () => {},
    getControlMode = () => "attack",
    getMatchState = () => "playing",
    runtimeComposition = browserRuntimeComposition
  }) {
    assertEventTarget(target);
    if (typeof clock !== "function") throw new TypeError("clock must be a function");
    if (typeof onCommand !== "function") throw new TypeError("onCommand must be a function");
    this.#target = target;
    this.#clock = clock;
    this.#onCommand = onCommand;
    this.#onApplicationRequest = onApplicationRequest;
    this.#onCameraCycle = onCameraCycle;
    this.#runtimeComposition = runtimeComposition;
    this.#getControlMode = runtimeComposition.authoritative
      ? () => runtimeComposition.controlMode
      : getControlMode;
    this.#getMatchState = runtimeComposition.authoritative
      ? () => runtimeComposition.state
      : getMatchState;
  }

  get attached() {
    return this.#attached;
  }

  get pressedCodes() {
    return Object.freeze([...this.#pressed]);
  }

  get activeCharge() {
    if (!this.#charge) return null;
    return Object.freeze({
      code: this.#charge.code,
      startedAt: this.#charge.startedAt,
      power: clamp((this.#clock() - this.#charge.startedAt) / CHARGE_DURATION_MS, 0, 1),
      modifiers: Object.freeze({ q: this.#charge.q, z: this.#charge.z })
    });
  }

  isPressed(code) {
    return this.#pressed.has(code);
  }

  attach() {
    if (this.#attached) return;
    this.#target.addEventListener("keydown", this.#handleKeyDown, { passive: false });
    this.#target.addEventListener("keyup", this.#handleKeyUp);
    this.#target.addEventListener("blur", this.#handleBlur);
    this.#attached = true;
  }

  detach() {
    if (!this.#attached) return;
    this.#target.removeEventListener("keydown", this.#handleKeyDown);
    this.#target.removeEventListener("keyup", this.#handleKeyUp);
    this.#target.removeEventListener("blur", this.#handleBlur);
    this.#attached = false;
    this.reset({ requestPause: false });
  }

  reset({ requestPause = false } = {}) {
    const wasSprinting = this.#pressed.has(FO4_CONTROLS.sprint);
    const wasShielding = this.#pressed.has(FO4_CONTROLS.shield);
    const wasGoalkeeperRushing = this.#pressed.has(FO4_CONTROLS.throughBall) && this.#getControlMode() === "defense";
    const wasTeamPressing = this.#pressed.has(FO4_CONTROLS.teammateRun) && this.#getControlMode() === "defense";
    this.#pressed.clear();
    this.#charge = null;
    this.#qTapStarted = false;
    this.#qConsumed = false;
    this.#emit(GameCommandType.MOVE, { x: 0, y: 0 });
    if (wasSprinting) this.#emit(GameCommandType.SET_SPRINT, { active: false });
    if (wasShielding) this.#emit(GameCommandType.SET_SHIELD, { active: false });
    if (wasGoalkeeperRushing) this.#emit(GameCommandType.SET_GOALKEEPER_RUSH, { active: false });
    if (wasTeamPressing) this.#emit(GameCommandType.SET_TEAM_PRESS, { active: false });
    if (requestPause && this.#getMatchState() === "playing") this.#onApplicationRequest("match:pause");
  }

  #emit(type, payload = {}) {
    const command = createGameCommand(type, payload, {
      source: GameCommandSource.HUMAN,
      sequence: this.#sequence
    });
    this.#sequence += 1;
    if (!this.#runtimeComposition.dispatch(command)) this.#onCommand(command);
    return command;
  }

  #emitMovement() {
    const movement = movementFromPressedCodes(this.#pressed);
    if (movement.x !== 0 || movement.y !== 0) this.#lastAim = movement;
    this.#emit(GameCommandType.MOVE, movement);
  }

  #beginAttackAction(code) {
    if (this.#charge) return;
    const q = this.#pressed.has(FO4_CONTROLS.teammateRun);
    if (q) this.#qConsumed = true;
    this.#charge = {
      code,
      startedAt: this.#clock(),
      q,
      z: this.#pressed.has(FO4_CONTROLS.finesse)
    };
  }

  #finishAttackAction(code) {
    if (!this.#charge || this.#charge.code !== code) return;
    const charge = this.#charge;
    this.#charge = null;
    const power = Math.max(0.08, clamp((this.#clock() - charge.startedAt) / CHARGE_DURATION_MS, 0, 1));
    const payload = {
      power,
      direction: this.#lastAim
    };
    let type = null;
    if (code === FO4_CONTROLS.shortPass) {
      type = GameCommandType.SHORT_PASS;
      payload.modifiers = { oneTwo: charge.q };
    } else if (code === FO4_CONTROLS.throughBall) {
      type = GameCommandType.THROUGH_BALL;
      payload.modifiers = { chip: charge.q };
    } else if (code === FO4_CONTROLS.loftPass) {
      type = GameCommandType.LOFTED_PASS;
    } else if (code === FO4_CONTROLS.shoot) {
      type = GameCommandType.SHOOT;
      payload.modifiers = { chip: charge.q, finesse: !charge.q && charge.z };
    }
    if (type) this.#emit(type, payload);
  }

  #handleKeyDown = (event) => {
    if (blockedCodes.has(event.code)) event.preventDefault();
    if (event.repeat && repeatedActionCodes.has(event.code)) return;
    this.#pressed.add(event.code);

    if (FO4_DIRECTION_CODES.includes(event.code)) {
      this.#emitMovement();
      if (event.shiftKey && this.#getControlMode() === "defense") {
        this.#emit(GameCommandType.SWITCH_PLAYER_DIRECTION, { direction: directionFromCode(event.code) });
      }
    }

    if (event.code === "Escape") {
      this.#onApplicationRequest("match:toggle-pause");
      return;
    }
    if (this.#getMatchState() !== "playing") return;

    const attacking = this.#getControlMode() === "attack";
    if (event.code === FO4_CONTROLS.sprint) this.#emit(GameCommandType.SET_SPRINT, { active: true });
    if (event.code === FO4_CONTROLS.shield) this.#emit(GameCommandType.SET_SHIELD, { active: true });
    if (attacking && FO4_ATTACK_ACTION_CODES.includes(event.code)) this.#beginAttackAction(event.code);
    if (!attacking && event.code === FO4_CONTROLS.shortPass) this.#emit(GameCommandType.SWITCH_PLAYER);
    if (!attacking && event.code === FO4_CONTROLS.loftPass) this.#emit(GameCommandType.SLIDE_TACKLE);
    if (!attacking && event.code === FO4_CONTROLS.tackle) this.#emit(GameCommandType.TACKLE);
    if (!attacking && event.code === FO4_CONTROLS.throughBall) this.#emit(GameCommandType.SET_GOALKEEPER_RUSH, { active: true });
    if (!attacking && event.code === FO4_CONTROLS.teammateRun) this.#emit(GameCommandType.SET_TEAM_PRESS, { active: true });
    if (attacking && event.code === FO4_CONTROLS.teammateRun) {
      this.#qTapStarted = true;
      this.#qConsumed = false;
    }
    if (event.code === FO4_CONTROLS.camera) this.#onCameraCycle();
  };

  #handleKeyUp = (event) => {
    const mode = this.#getControlMode();
    this.#pressed.delete(event.code);
    if (FO4_DIRECTION_CODES.includes(event.code)) this.#emitMovement();
    if (event.code === FO4_CONTROLS.sprint) this.#emit(GameCommandType.SET_SPRINT, { active: false });
    if (event.code === FO4_CONTROLS.shield) this.#emit(GameCommandType.SET_SHIELD, { active: false });
    if (mode === "defense" && event.code === FO4_CONTROLS.throughBall) this.#emit(GameCommandType.SET_GOALKEEPER_RUSH, { active: false });
    if (mode === "defense" && event.code === FO4_CONTROLS.teammateRun) this.#emit(GameCommandType.SET_TEAM_PRESS, { active: false });

    if (FO4_ATTACK_ACTION_CODES.includes(event.code)) {
      if (mode === "attack") this.#finishAttackAction(event.code);
      else this.#charge = null;
    }
    if (event.code === FO4_CONTROLS.teammateRun) {
      if (mode === "attack" && this.#qTapStarted && !this.#qConsumed) {
        this.#emit(GameCommandType.TRIGGER_TEAMMATE_RUN);
      }
      this.#qTapStarted = false;
      this.#qConsumed = false;
    }
  };

  #handleBlur = () => {
    this.reset({ requestPause: true });
  };
}
