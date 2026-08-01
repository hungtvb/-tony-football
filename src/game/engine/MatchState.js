import { createPossessionLifecycle } from "../gameplay/PossessionLifecycle.js";
import { ballControlConfig } from "../config/ballControlConfig.js";
import {
  assertSimulationWorldDimensions,
  DEFAULT_SIMULATION_SCALE_PROFILE,
} from "../config/simulationScaleProfile.js";

export const HOME_TEAM = 0;
export const AWAY_TEAM = 1;
export const DEFAULT_MATCH_SECONDS = 150;
export const DEFAULT_KICKOFF_DELAY = 1.25;
export const MATCH_BALL_ID = "match-ball";

export const DIFFICULTY_SCALE = Object.freeze({
  rookie: 0.78,
  pro: 1,
  legend: 1.18
});

function freezeFormation(formation) {
  return Object.freeze(formation.map((player) => Object.freeze({ ...player })));
}

export const DEFAULT_FORMATIONS = Object.freeze({
  home: freezeFormation([
    { x: 140, y: 350, role: "GK", name: "KAI", number: 1, rating: 86 },
    { x: 270, y: 205, role: "DF", name: "MINH", number: 4, rating: 87 },
    { x: 270, y: 495, role: "DF", name: "NAM", number: 5, rating: 86 },
    { x: 500, y: 350, role: "MF", name: "HÙNG", number: 8, rating: 90 },
    { x: 690, y: 205, role: "FW", name: "TONY", number: 10, rating: 92 },
    { x: 690, y: 495, role: "FW", name: "PHÚC", number: 11, rating: 89 }
  ]),
  away: freezeFormation([
    { x: 1060, y: 350, role: "GK", name: "NOVA", number: 1, rating: 87 },
    { x: 930, y: 205, role: "DF", name: "VEX", number: 3, rating: 88 },
    { x: 930, y: 495, role: "DF", name: "ZERO", number: 5, rating: 87 },
    { x: 700, y: 350, role: "MF", name: "ECHO", number: 8, rating: 91 },
    { x: 520, y: 205, role: "FW", name: "BLAZE", number: 9, rating: 92 },
    { x: 520, y: 495, role: "FW", name: "RUSH", number: 11, rating: 90 }
  ])
});

function playerId(team, index) {
  return `${team === HOME_TEAM ? "home" : "away"}-${index}`;
}

function createPlayer(team, spec, index, scaleProfile) {
  const attackDirection = team === HOME_TEAM ? 1 : -1;
  return {
    id: playerId(team, index),
    team,
    index,
    baseX: spec.x,
    baseY: spec.y,
    role: spec.role,
    name: spec.name,
    number: spec.number,
    rating: spec.rating,
    x: spec.x,
    y: spec.y,
    vx: 0,
    vy: 0,
    dirX: attackDirection,
    dirY: 0,
    radius: spec.role === "GK"
      ? scaleProfile.player.goalkeeperCollisionRadiusSimulation
      : scaleProfile.player.collisionRadiusSimulation,
    stamina: 100,
    cooldown: 0,
    anim: "idle",
    animTime: 0,
    animDuration: 1,
    animPower: 0,
    stepPhase: index * 1.7,
    sprinting: false,
    diveCooldown: 0,
    controlBoost: 0,
    motionYaw: Math.atan2(attackDirection, 0),
    turnLean: 0,
    strideBlend: 0,
    dribbleSide: index % 2 ? 1 : -1
  };
}

export function createMatchPlayers(
  formations = DEFAULT_FORMATIONS,
  scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE,
) {
  return [
    ...formations.home.map((spec, index) => createPlayer(HOME_TEAM, spec, index, scaleProfile)),
    ...formations.away.map((spec, index) => createPlayer(AWAY_TEAM, spec, index, scaleProfile))
  ];
}

function preferredHomePlayer(players) {
  return players.find((player) => player.team === HOME_TEAM && player.number === 10)
    ?? players.find((player) => player.team === HOME_TEAM && player.role !== "GK")
    ?? players.find((player) => player.team === HOME_TEAM)
    ?? null;
}

export function createMatchBall({
  scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE,
  width = scaleProfile.simulation.worldWidth,
  height = scaleProfile.simulation.worldHeight,
  lock = 0,
} = {}) {
  assertSimulationWorldDimensions(width, height, scaleProfile);
  return {
    id: MATCH_BALL_ID,
    x: width / 2,
    y: height / 2,
    vx: 0,
    vy: 0,
    height: 0,
    vz: 0,
    curve: 0,
    radius: scaleProfile.ball.radiusSimulation,
    ownerId: null,
    lastTouchId: null,
    lock,
    trail: [],
    pendingPass: null,
    angle: 0,
    spin: 0,
    possession: createPossessionLifecycle()
  };
}

export function createMatchState({
  formations = DEFAULT_FORMATIONS,
  matchSeconds = DEFAULT_MATCH_SECONDS,
  kickoffDelay = DEFAULT_KICKOFF_DELAY,
  difficulty = "pro",
  pitchStyle = "classic",
  ballStyle = "classic",
  weather = "clear",
  scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE,
  width = scaleProfile.simulation.worldWidth,
  height = scaleProfile.simulation.worldHeight,
  runtimeState = "menu"
} = {}) {
  if (!Object.hasOwn(DIFFICULTY_SCALE, difficulty)) {
    throw new TypeError(`Unknown difficulty: ${difficulty}`);
  }
  if (!Number.isFinite(matchSeconds) || matchSeconds <= 0) {
    throw new RangeError("matchSeconds must be a positive finite number");
  }
  if (!Number.isFinite(kickoffDelay) || kickoffDelay < 0) {
    throw new RangeError("kickoffDelay must be a non-negative finite number");
  }
  assertSimulationWorldDimensions(width, height, scaleProfile);

  const players = createMatchPlayers(formations, scaleProfile);
  return {
    match: {
      state: runtimeState,
      difficulty,
      ai: DIFFICULTY_SCALE[difficulty],
      time: matchSeconds,
      matchSeconds,
      score: [0, 0],
      stats: { possession: [0, 0], shots: [0, 0], passes: 0, completed: 0 },
      elapsed: 0,
      kickoffTimer: runtimeState === "playing" ? kickoffDelay : 0,
      goalSequence: null
    },
    settings: { pitchStyle, ballStyle, weather },
    players,
    ball: createMatchBall({
      width,
      height,
      lock: runtimeState === "playing" ? ballControlConfig.release.kickoffLock : 0,
      scaleProfile,
    }),
    selectedPlayerId: preferredHomePlayer(players)?.id ?? null,
    controls: {
      moveX: 0,
      moveY: 0,
      sprinting: false,
      shielding: false,
      goalkeeperRush: false,
      teamPress: false,
      lastMode: runtimeState === "playing" ? "attack" : "defense"
    },
    replay: {
      active: false,
      elapsed: 0,
      duration: 3.05
    }
  };
}

export function findPlayer(state, id) {
  return state.players.find((player) => player.id === id) ?? null;
}

export function resetForKickoff(state, team, {
  kickoffDelay = DEFAULT_KICKOFF_DELAY,
  scaleProfile = DEFAULT_SIMULATION_SCALE_PROFILE,
  width = scaleProfile.simulation.worldWidth,
  height = scaleProfile.simulation.worldHeight,
} = {}) {
  assertSimulationWorldDimensions(width, height, scaleProfile);
  const freshPlayers = createMatchPlayers({
    home: state.players.filter((player) => player.team === HOME_TEAM).map((player) => ({
      x: player.baseX,
      y: player.baseY,
      role: player.role,
      name: player.name,
      number: player.number,
      rating: player.rating
    })),
    away: state.players.filter((player) => player.team === AWAY_TEAM).map((player) => ({
      x: player.baseX,
      y: player.baseY,
      role: player.role,
      name: player.name,
      number: player.number,
      rating: player.rating
    }))
  }, scaleProfile);

  state.players = freshPlayers.map((freshPlayer) => {
    const previous = findPlayer(state, freshPlayer.id);
    return { ...freshPlayer, stamina: Math.max(55, previous?.stamina ?? 100) };
  });
  state.ball = createMatchBall({
    width,
    height,
    lock: ballControlConfig.release.kickoffLock,
    scaleProfile,
  });
  state.match.goalSequence = null;
  state.match.kickoffTimer = kickoffDelay;
  state.controls.moveX = 0;
  state.controls.moveY = 0;
  state.controls.sprinting = false;
  state.controls.shielding = false;
  state.controls.goalkeeperRush = false;
  state.controls.teamPress = false;
  state.controls.lastMode = team === HOME_TEAM ? "attack" : "defense";

  const taker = state.players.find((player) => (
    player.team === team && player.index === 4
  ));
  if (taker) {
    taker.x = width / 2 + (team === HOME_TEAM ? -26 : 26);
    taker.y = height / 2;
  }

  if (team === HOME_TEAM) {
    state.selectedPlayerId = preferredHomePlayer(state.players)?.id ?? null;
  } else {
    const homeOutfield = state.players.filter((player) => player.team === HOME_TEAM && player.role !== "GK");
    state.selectedPlayerId = homeOutfield.sort((a, b) => (
      Math.hypot(a.x - width / 2, a.y - height / 2) - Math.hypot(b.x - width / 2, b.y - height / 2)
    ))[0]?.id ?? preferredHomePlayer(state.players)?.id ?? null;
  }
}

export function createSnapshotInput(state, tick) {
  return {
    tick,
    match: {
      ...state.match,
      score: state.match.score.slice(),
      stats: {
        possession: state.match.stats.possession.slice(),
        shots: state.match.stats.shots.slice(),
        passes: state.match.stats.passes,
        completed: state.match.stats.completed
      },
      selectedPlayerId: state.selectedPlayerId,
      settings: { ...state.settings },
      controls: { ...state.controls },
      replay: { ...state.replay }
    },
    players: state.players.map((player) => ({ ...player })),
    ball: {
      ...state.ball,
      trail: state.ball.trail.map((point) => ({ ...point })),
      pendingPass: state.ball.pendingPass ? { ...state.ball.pendingPass } : null,
      possession: { ...state.ball.possession }
    }
  };
}
