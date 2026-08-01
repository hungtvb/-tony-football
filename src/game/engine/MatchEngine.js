import { GameCommandBuffer, GameCommandSource, GameCommandType } from "./GameCommands.js";
import { GameEventQueue, GameEventType } from "./GameEvents.js";
import {
  DEFAULT_GOAL_SEQUENCE_DURATION,
  GoalSequencePhase,
  advanceGoalSequence,
  createGoalSequence,
  createGoalSequenceTimeline
} from "./GoalSequenceTimeline.js";
import { createMatchSnapshot, createSnapshotFrame } from "./MatchSnapshot.js";
import { createSeededRandom } from "../core/Random.js";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../config/simulationScaleProfile.js";
import { advanceAIDecisions } from "./AIDecisionSystem.js";
import { advanceBallSimulation } from "./BallSimulationSystem.js";
import { executeKickAction } from "./KickActionSystem.js";
import { advancePlayerMovement, createFieldBounds } from "./PlayerMovementSystem.js";
import { executeTackle, triggerTeammateRun } from "./PlayerActionSystem.js";
import { controlPossession, releasePossession } from "../gameplay/PossessionLifecycle.js";
import {
  AWAY_TEAM,
  DEFAULT_FORMATIONS,
  DEFAULT_KICKOFF_DELAY,
  DEFAULT_MATCH_SECONDS,
  HOME_TEAM,
  createMatchState,
  createSnapshotInput,
  findPlayer,
  resetForKickoff
} from "./MatchState.js";

const kickActionTypes = new Set([
  GameCommandType.SHORT_PASS,
  GameCommandType.THROUGH_BALL,
  GameCommandType.LOFTED_PASS,
  GameCommandType.SHOOT
]);
const SELECTED_OWNER_IDLE_DELAY_SECONDS = 1.5;

function assertDelta(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    throw new RangeError("MatchEngine step requires a positive finite delta");
  }
}

function assertTeam(team) {
  if (team !== HOME_TEAM && team !== AWAY_TEAM) {
    throw new RangeError(`Unknown team: ${team}`);
  }
}

export class MatchEngine {
  #config;
  #state;
  #tick = 0;
  #commands = new GameCommandBuffer();
  #events = new GameEventQueue();
  #actionIntents = [];
  #random;
  #previousSnapshot;
  #currentSnapshot;
  #snapshotDiscontinuity = false;
  #humanIdleSeconds = 0;
  #selectedOwnerId = null;
  #activeHumanAttackIntent = false;

  constructor({
    formations = DEFAULT_FORMATIONS,
    matchSeconds = DEFAULT_MATCH_SECONDS,
    kickoffDelay = DEFAULT_KICKOFF_DELAY,
    goalDuration = DEFAULT_GOAL_SEQUENCE_DURATION,
    difficulty = "pro",
    pitchStyle = "classic",
    ballStyle = "classic",
    weather = "clear",
    randomSeed = "tony-football-r1",
    width = DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldWidth,
    height = DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldHeight,
    scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE
  } = {}) {
    if (!Number.isFinite(goalDuration) || goalDuration <= 0) {
      throw new RangeError("goalDuration must be a positive finite number");
    }
    this.#config = {
      formations,
      matchSeconds,
      kickoffDelay,
      goalDuration,
      goalTimeline: createGoalSequenceTimeline(goalDuration),
      difficulty,
      pitchStyle,
      ballStyle,
      weather,
      randomSeed,
      width,
      height,
      scaleProfile
    };
    this.#config.field = createFieldBounds(width, height, scaleProfile);
    this.#random = createSeededRandom(randomSeed);
    this.#state = createMatchState(this.#config);
    this.#state.replay.duration = this.#config.goalTimeline.replayDuration;
    this.#currentSnapshot = this.#captureSnapshot();
    this.#previousSnapshot = this.#currentSnapshot;
  }

  get tick() {
    return this.#tick;
  }

  get snapshot() {
    return this.#currentSnapshot;
  }

  get commandCount() {
    return this.#commands.size;
  }

  enqueue(type, payload = {}, options = {}) {
    return this.#commands.enqueue(type, payload, options);
  }

  step(deltaSeconds) {
    assertDelta(deltaSeconds);
    this.#tick += 1;
    this.#previousSnapshot = this.#currentSnapshot;

    for (const command of this.#commands.drainReady(this.#tick)) this.#applyCommand(command);
    if (this.#advanceLifecycle(deltaSeconds)) this.#advanceSimulation(deltaSeconds);
    this.#currentSnapshot = this.#captureSnapshot();
    if (this.#snapshotDiscontinuity) {
      this.#previousSnapshot = this.#currentSnapshot;
      this.#snapshotDiscontinuity = false;
    }
    return this.#currentSnapshot;
  }

  createRenderFrame(alpha) {
    return createSnapshotFrame(this.#previousSnapshot, this.#currentSnapshot, alpha);
  }

  drainEvents() {
    return this.#events.drain();
  }

  drainActionIntents() {
    const intents = Object.freeze(this.#actionIntents.slice());
    this.#actionIntents.length = 0;
    return intents;
  }

  recordGoal(team, { scorerId = null } = {}) {
    assertTeam(team);
    if (this.#state.match.state !== "playing" || this.#state.match.goalSequence) return false;
    if (scorerId !== null) {
      const scorer = findPlayer(this.#state, scorerId);
      if (!scorer || scorer.team !== team) throw new TypeError("scorerId must reference the scoring team");
    }

    this.#state.match.score[team] += 1;
    this.#state.match.goalSequence = createGoalSequence({
      team,
      nextTeam: team === HOME_TEAM ? AWAY_TEAM : HOME_TEAM,
      scorerId,
      timeline: this.#config.goalTimeline
    });
    this.#state.ball.ownerId = null;
    this.#state.ball.possession = releasePossession(
      this.#state.ball.possession,
      "goal",
      this.#state.ball.lastTouchId
    );
    this.#events.emit(GameEventType.SCORE_CHANGED, {
      team,
      scorerId,
      score: this.#state.match.score.slice()
    }, { tick: this.#tick });
    return true;
  }

  setPossession(ownerId, { reason = "control" } = {}) {
    if (ownerId !== null && !findPlayer(this.#state, ownerId)) {
      throw new TypeError(`Unknown possession owner: ${ownerId}`);
    }
    const previousOwnerId = this.#state.ball.ownerId;
    if (previousOwnerId === ownerId) return false;
    this.#state.ball.ownerId = ownerId;
    if (ownerId !== null) {
      this.#state.ball.lastTouchId = ownerId;
      this.#state.ball.possession = controlPossession(this.#state.ball.possession, ownerId, reason);
    } else {
      this.#state.ball.possession = releasePossession(
        this.#state.ball.possession,
        reason,
        previousOwnerId
      );
    }
    this.#events.emit(GameEventType.POSSESSION_CHANGED, {
      previousOwnerId,
      ownerId,
      reason
    }, { tick: this.#tick });
    return true;
  }

  startReplay() {
    if (this.#state.replay.active) return false;
    this.#state.replay.active = true;
    this.#state.replay.elapsed = 0;
    this.#events.emit(GameEventType.REPLAY_STARTED, {}, { tick: this.#tick });
    return true;
  }

  endReplay() {
    if (!this.#state.replay.active) return false;
    this.#state.replay.active = false;
    this.#events.emit(GameEventType.REPLAY_ENDED, {}, { tick: this.#tick });
    return true;
  }

  endMatch() {
    if (this.#state.match.state === "ended") return false;
    this.#state.match.state = "ended";
    this.#state.match.time = Math.max(0, this.#state.match.time);
    this.#events.emit(GameEventType.MATCH_ENDED, {
      score: this.#state.match.score.slice(),
      stats: {
        possession: this.#state.match.stats.possession.slice(),
        shots: this.#state.match.stats.shots.slice(),
        passes: this.#state.match.stats.passes,
        completed: this.#state.match.stats.completed
      }
    }, { tick: this.#tick });
    return true;
  }

  #applyCommand(command) {
    if (command.source === GameCommandSource.HUMAN) this.#humanIdleSeconds = 0;
    switch (command.type) {
      case GameCommandType.START_MATCH:
        this.#resetRuntime("playing");
        this.#events.emit(GameEventType.MATCH_STARTED, {}, { tick: this.#tick });
        break;
      case GameCommandType.RESTART_MATCH:
        this.#resetRuntime("playing");
        this.#events.emit(GameEventType.MATCH_RESTARTED, {}, { tick: this.#tick });
        break;
      case GameCommandType.PAUSE_MATCH:
        if (this.#state.match.state === "playing") {
          this.#state.match.state = "paused";
          this.#events.emit(GameEventType.MATCH_PAUSED, {}, { tick: this.#tick });
        }
        break;
      case GameCommandType.RESUME_MATCH:
        if (this.#state.match.state === "paused") {
          this.#state.match.state = "playing";
          this.#events.emit(GameEventType.MATCH_RESUMED, {}, { tick: this.#tick });
        }
        break;
      case GameCommandType.MOVE:
        this.#state.controls.moveX = command.payload.x;
        this.#state.controls.moveY = command.payload.y;
        break;
      case GameCommandType.SET_SPRINT:
        this.#state.controls.sprinting = command.payload.active;
        break;
      case GameCommandType.SET_ATTACK_INTENT:
        this.#activeHumanAttackIntent = command.payload.active;
        break;
      case GameCommandType.SET_SHIELD:
        this.#state.controls.shielding = command.payload.active;
        break;
      case GameCommandType.SET_GOALKEEPER_RUSH:
        this.#state.controls.goalkeeperRush = command.payload.active;
        break;
      case GameCommandType.SET_TEAM_PRESS:
        this.#state.controls.teamPress = command.payload.active;
        break;
      case GameCommandType.SWITCH_PLAYER:
        if (this.#state.match.state === "playing") this.#switchControlledPlayer();
        break;
      case GameCommandType.SWITCH_PLAYER_DIRECTION:
        if (this.#state.match.state === "playing") this.#switchControlledPlayer(command.payload.direction);
        break;
      case GameCommandType.TACKLE:
        if (this.#state.match.state === "playing") this.#applyTackleCommand("standing");
        break;
      case GameCommandType.SLIDE_TACKLE:
        if (this.#state.match.state === "playing") this.#applyTackleCommand("slide");
        break;
      case GameCommandType.TRIGGER_TEAMMATE_RUN:
        if (this.#state.match.state === "playing") this.#applyTeammateRunCommand();
        break;
      default:
        if (kickActionTypes.has(command.type) && this.#state.match.state === "playing") {
          this.#applyKickCommand(command);
        }
    }
  }

  #applyKickCommand(command) {
    const previousOwnerId = this.#state.ball.ownerId;
    const result = executeKickAction(this.#state, command, {
      field: this.#config.field,
      height: this.#config.height,
      random: this.#random
    });
    if (!result) return;
    this.#events.emit(GameEventType.BALL_KICKED, result, { tick: this.#tick });
    this.#events.emit(GameEventType.POSSESSION_CHANGED, {
      previousOwnerId,
      ownerId: null,
      reason: result.style
    }, { tick: this.#tick });
  }

  #applyTackleCommand(style) {
    const result = executeTackle(this.#state, { random: this.#random, style });
    if (!result) return;
    this.#events.emit(GameEventType.TACKLE_RESOLVED, result, { tick: this.#tick });
    if (result.won) {
      this.#events.emit(GameEventType.POSSESSION_CHANGED, {
        previousOwnerId: result.previousOwnerId,
        ownerId: null,
        reason: "tackle"
      }, { tick: this.#tick });
    }
  }

  #applyTeammateRunCommand() {
    const result = triggerTeammateRun(this.#state);
    if (result) {
      this.#events.emit(GameEventType.TEAMMATE_RUN_TRIGGERED, result, { tick: this.#tick });
    }
  }

  #emitGoalPhase(previousPhase, phase) {
    const sequence = this.#state.match.goalSequence;
    if (!sequence) return;
    const phaseEntry = sequence.phases.find((entry) => entry.phase === phase) ?? null;
    this.#events.emit(GameEventType.GOAL_PHASE_CHANGED, {
      previousPhase,
      phase,
      team: sequence.team,
      scorerId: sequence.scorerId,
      score: this.#state.match.score.slice(),
      elapsed: sequence.elapsed,
      duration: sequence.duration,
      phaseDuration: phaseEntry?.duration ?? 0
    }, { tick: this.#tick });
  }

  #advanceGoalLifecycle(deltaSeconds) {
    const sequence = this.#state.match.goalSequence;
    const result = advanceGoalSequence(sequence, deltaSeconds);

    for (const action of result.actions) {
      if (action.type === "advance") {
        if (action.phase === GoalSequencePhase.REPLAY && this.#state.replay.active) {
          this.#state.replay.elapsed = Math.min(
            this.#state.replay.duration,
            this.#state.replay.elapsed + action.deltaSeconds
          );
        }
        continue;
      }

      if (action.phase === GoalSequencePhase.REPLAY) {
        this.#emitGoalPhase(action.previousPhase, action.phase);
        this.startReplay();
        continue;
      }

      if (action.phase === GoalSequencePhase.KICKOFF) {
        if (this.#state.replay.active) this.endReplay();
        this.#emitGoalPhase(action.previousPhase, action.phase);
        const nextTeam = sequence.nextTeam;
        resetForKickoff(this.#state, nextTeam, {
          kickoffDelay: this.#config.kickoffDelay,
          width: this.#config.width,
          height: this.#config.height,
          scaleProfile: this.#config.scaleProfile
        });
        this.#snapshotDiscontinuity = true;
        continue;
      }

      this.#emitGoalPhase(action.previousPhase, action.phase);
    }
  }

  #advanceLifecycle(deltaSeconds) {
    if (this.#state.match.state !== "playing") return false;

    if (this.#state.match.goalSequence) {
      this.#advanceGoalLifecycle(deltaSeconds);
      return false;
    }

    if (this.#state.replay.active) {
      this.#state.replay.elapsed += deltaSeconds;
      if (this.#state.replay.elapsed >= this.#state.replay.duration) this.endReplay();
    }

    if (this.#state.match.kickoffTimer > 0) {
      this.#state.match.kickoffTimer = Math.max(0, this.#state.match.kickoffTimer - deltaSeconds);
      return false;
    }

    this.#state.match.time = Math.max(0, this.#state.match.time - deltaSeconds);
    if (this.#state.match.time === 0) {
      this.endMatch();
      return false;
    }
    return true;
  }

  #advanceSimulation(deltaSeconds) {
    this.#state.match.elapsed += deltaSeconds;
    const controls = this.#state.controls;
    const controlsAreIdle = controls.moveX === 0
      && controls.moveY === 0
      && !controls.sprinting
      && !controls.shielding;
    const selectedOwnerId = this.#state.ball.ownerId === this.#state.selectedPlayerId
      ? this.#state.selectedPlayerId
      : null;
    if (selectedOwnerId !== this.#selectedOwnerId) {
      this.#selectedOwnerId = selectedOwnerId;
      this.#humanIdleSeconds = 0;
    }
    if (selectedOwnerId && controlsAreIdle && !this.#activeHumanAttackIntent) {
      this.#humanIdleSeconds += deltaSeconds;
    } else {
      this.#humanIdleSeconds = 0;
    }
    const aiCommands = advanceAIDecisions(this.#state, deltaSeconds, {
      field: this.#config.field,
      width: this.#config.width,
      height: this.#config.height,
      random: this.#random,
      tick: this.#tick,
      allowSelectedOwnerAction: controlsAreIdle
        && !this.#activeHumanAttackIntent
        && this.#humanIdleSeconds >= SELECTED_OWNER_IDLE_DELAY_SECONDS
    });
    for (const command of aiCommands) this.#applyCommand(command);
    const previousOwnerId = this.#state.ball.ownerId;
    advancePlayerMovement(this.#state, deltaSeconds, { field: this.#config.field });
    const { goalTeam } = advanceBallSimulation(this.#state, deltaSeconds, {
      field: this.#config.field
    });
    const ownerId = this.#state.ball.ownerId;
    if (ownerId !== previousOwnerId) {
      this.#events.emit(GameEventType.POSSESSION_CHANGED, {
        previousOwnerId,
        ownerId,
        reason: this.#state.ball.possession.touchOutcome
          ?? this.#state.ball.possession.releaseReason
          ?? "simulation"
      }, { tick: this.#tick });
    }
    if (goalTeam !== null) {
      const scorer = findPlayer(this.#state, this.#state.ball.lastTouchId);
      this.recordGoal(goalTeam, {
        scorerId: scorer?.team === goalTeam ? scorer.id : null
      });
    }
  }

  #switchControlledPlayer(direction = null) {
    const candidates = this.#state.players.filter((player) => player.team === HOME_TEAM && player.role !== "GK");
    if (direction) {
      const selected = findPlayer(this.#state, this.#state.selectedPlayerId);
      if (!selected) return;
      const target = findPlayer(this.#state, this.#state.ball.ownerId) ?? this.#state.ball;
      let best = null;
      let bestScore = 20;
      for (const player of candidates) {
        if (player === selected) continue;
        const dx = player.x - selected.x;
        const dy = player.y - selected.y;
        const gap = Math.hypot(dx, dy) || 1;
        const alignment = dx / gap * direction.x + dy / gap * direction.y;
        const targetGap = Math.hypot(player.x - target.x, player.y - target.y);
        const score = alignment * 360 - gap * 0.22 - targetGap * 0.06;
        if (score > bestScore) {
          best = player;
          bestScore = score;
        }
      }
      if (best) this.#state.selectedPlayerId = best.id;
      return;
    }
    const currentIndex = candidates.findIndex((player) => player.id === this.#state.selectedPlayerId);
    this.#state.selectedPlayerId = candidates[(currentIndex + 1 + candidates.length) % candidates.length].id;
  }

  #resetRuntime(runtimeState) {
    this.#state = createMatchState({
      ...this.#config,
      difficulty: this.#state.match.difficulty,
      pitchStyle: this.#state.settings.pitchStyle,
      ballStyle: this.#state.settings.ballStyle,
      weather: this.#state.settings.weather,
      runtimeState
    });
    this.#state.replay.duration = this.#config.goalTimeline.replayDuration;
    this.#random = createSeededRandom(this.#config.randomSeed);
    this.#actionIntents.length = 0;
    this.#humanIdleSeconds = 0;
    this.#selectedOwnerId = null;
    this.#activeHumanAttackIntent = false;
    this.#snapshotDiscontinuity = true;
  }

  #captureSnapshot() {
    return createMatchSnapshot(createSnapshotInput(this.#state, this.#tick));
  }
}
