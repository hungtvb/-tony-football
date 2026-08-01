import { createSnapshotRenderState } from "./SnapshotRenderState.js";
import { createPlayerModelView } from "./PlayerModelView.js";
import { createBallModelView } from "./BallModelView.js";
import { createDefaultPlayerAssetLoader, disposePlayerAssetTemplate } from "./PlayerAssetLoader.js";
import { DEFAULT_SIMULATION_SCALE_PROFILE } from "../config/simulationScaleProfile.js";
import { ensureRigFootballKitOverlay, rigFootballKitEvidence } from "./RigFootballKitOverlay.js";

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}
function defaultVisualTestMode(target) {
  return new URLSearchParams(target?.location?.search ?? "").get("visualTest") === "1";
}
function defaultLowPowerDevice(target) {
  return defaultVisualTestMode(target) || (target?.matchMedia?.("(pointer: coarse)")?.matches ?? false) || Number(target?.navigator?.deviceMemory ?? Infinity) <= 4;
}
function createWorldProjection({
  width = DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldWidth,
  height = DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldHeight,
  scale = DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldUnitsPerSimulationUnit,
} = {}) {
  return Object.freeze({
    profileId: DEFAULT_SIMULATION_SCALE_PROFILE.id,
    width,
    height,
    scale,
    worldX: (value) => (value - width / 2) * scale,
    worldZ: (value) => (value - height / 2) * scale,
  });
}
function appearanceDiagnostics(playerViews) {
  const players = Object.freeze([...playerViews.values()].map((view) => {
    const diagnostics = view.diagnostics?.() ?? Object.freeze({});
    const appearance = diagnostics.appearance ?? Object.freeze({ mode: diagnostics.rigged ? "asset" : "fallback", bootCount: 0, preservedMapCount: 0, tintedKitMaterialCount: 0, materialCount: 0, semanticCounts: Object.freeze({}) });
    const overlay = diagnostics.rigged ? rigFootballKitEvidence(view.root) : Object.freeze({ installed: false, visibleKitNodeCount: 0, bootGeometryCount: Number(appearance.bootCount || 0), nodes: Object.freeze([]) });
    return Object.freeze({
      id: diagnostics.id ?? view.id ?? null,
      team: diagnostics.team ?? null,
      role: diagnostics.role ?? null,
      rigged: Boolean(diagnostics.rigged),
      ...appearance,
      rigKitInstalled: overlay.installed,
      visibleKitNodeCount: overlay.visibleKitNodeCount,
      bootGeometryCount: overlay.bootGeometryCount,
      bootCount: diagnostics.rigged ? overlay.bootGeometryCount : Number(appearance.bootCount || 0),
      rigKitNodes: overlay.nodes,
      scale: diagnostics.scale ?? null,
      motion: diagnostics.motion ?? null,
    });
  }));
  return Object.freeze({
    players,
    riggedPlayers: players.filter((player) => player.rigged).length,
    fallbackPlayers: players.filter((player) => !player.rigged).length,
    bootlessPlayers: players.filter((player) => Number(player.bootGeometryCount || player.bootCount || 0) < 1).length,
    preservedMapPlayers: players.filter((player) => Number(player.preservedMapCount || 0) > 0).length,
    tintedKitPlayers: players.filter((player) => Number(player.tintedKitMaterialCount || 0) > 0).length,
    visibleKitPlayers: players.filter((player) => !player.rigged || (player.rigKitInstalled && Number(player.visibleKitNodeCount || 0) >= 7 && Number(player.bootGeometryCount || 0) === 2)).length,
  });
}

export function createBrowserModelViewAdapter({ target, document, getScenePort, isSceneBound = () => Boolean(getScenePort?.()), createPlayerView = createPlayerModelView, createBallView = createBallModelView, assetLoader = createDefaultPlayerAssetLoader(), visualTestMode = defaultVisualTestMode(target), lowPowerDevice = defaultLowPowerDevice(target), world = createWorldProjection() } = {}) {
  if (!target || typeof target !== "object") throw new TypeError("BrowserModelViewAdapter requires a target");
  if (!document || typeof document.getElementById !== "function" || typeof document.createElement !== "function") throw new TypeError("BrowserModelViewAdapter requires a document");
  assertFunction(getScenePort, "getScenePort"); assertFunction(isSceneBound, "isSceneBound"); assertFunction(createPlayerView, "createPlayerView"); assertFunction(createBallView, "createBallView");
  assertFunction(assetLoader?.loadCharacter, "assetLoader.loadCharacter"); assertFunction(assetLoader?.loadAnimations, "assetLoader.loadAnimations"); assertFunction(world?.worldX, "world.worldX"); assertFunction(world?.worldZ, "world.worldZ");

  const playerViews = new Map();
  let scenePort = null; let ballView = null; let characterScene = null; let animations = Object.freeze([]);
  let attached = false; let disposed = false; let terminating = false; let loadGeneration = 0; let assetState = "idle"; let assetDetail = "";

  function unavailable() { return disposed || terminating; }
  function setAssetStatus(state, label, detail = "") {
    assetState = state; assetDetail = detail;
    const status = Object.freeze({ state, label, detail, updatedAt: new Date().toISOString() }); target.__playerAssetStatus = status;
    const badge = document.getElementById("assetStatus");
    if (badge) { badge.className = `asset-status ${state}`; badge.textContent = label; badge.title = detail; }
    return status;
  }
  function installRigAsset(view, playerFacts) {
    const installed = view.installAsset?.({ characterScene, animations });
    if (!view.rigged) return Boolean(installed);
    const evidence = ensureRigFootballKitOverlay({ root: view.root, player: playerFacts, lowPowerDevice });
    if (evidence.visibleKitNodeCount < 7 || evidence.bootGeometryCount !== 2) throw new Error(`player model view ${playerFacts?.id ?? view.id} rejected incomplete rig kit geometry`);
    return true;
  }
  function createView(player) {
    const view = createPlayerView({ player, scenePort, document, worldX: world.worldX, worldZ: world.worldZ, lowPowerDevice });
    if (view.attach?.() === false) { view.teardown?.(); throw new Error(`player model view ${player.id} rejected scene attachment`); }
    if (characterScene) installRigAsset(view, player);
    playerViews.set(player.id, view); return view;
  }
  function reconcilePlayers(players) {
    const activeIds = new Set(players.map((player) => player.id));
    for (const [id, view] of playerViews) { if (activeIds.has(id)) continue; view.teardown?.(); playerViews.delete(id); }
    for (const player of players) if (!playerViews.has(player.id)) createView(player);
  }
  async function loadAssets(generation, { reuseCharacterScene = false } = {}) {
    if (reuseCharacterScene) {
      setAssetStatus("loading", "MODEL RETAINED · ANIMATION LOADING", "Keeping the live shared character template while refreshing animation clips");
    } else {
      setAssetStatus("loading", "MODEL · LOADING", "Loading football-character-v2.glb");
      try {
        const character = await assetLoader.loadCharacter();
        if (unavailable() || generation !== loadGeneration) { disposePlayerAssetTemplate(character?.scene); return false; }
        const nextCharacterScene = character?.scene ?? null;
        if (!nextCharacterScene) throw new Error("character asset has no scene");
        if (characterScene && characterScene !== nextCharacterScene) {
          disposePlayerAssetTemplate(nextCharacterScene);
          throw new Error("character template replacement is blocked while live rigs may share its geometry");
        }
        characterScene = nextCharacterScene;
        for (const view of playerViews.values()) installRigAsset(view, view.diagnostics?.() ?? Object.freeze({ id: view.id, team: 0, role: "FW" }));
        setAssetStatus("ready", "FOOTBALL KIT · READY", "Character, explicit jersey/shorts/socks and boot geometry loaded");
      } catch (error) {
        if (unavailable() || generation !== loadGeneration) return false;
        setAssetStatus("error", "MODEL · FALLBACK", error?.message ?? String(error)); return false;
      }
    }
    try {
      const motion = await assetLoader.loadAnimations();
      if (unavailable() || generation !== loadGeneration) { disposePlayerAssetTemplate(motion?.scene); return false; }
      animations = Object.freeze([...(motion?.animations ?? [])]);
      for (const view of playerViews.values()) view.installAnimations?.(animations);
      disposePlayerAssetTemplate(motion?.scene);
      setAssetStatus("ready", "PLAYER RIG + KIT · READY", `${animations.length} animation clips; explicit football clothing and boots attached`); return true;
    } catch (error) {
      if (unavailable() || generation !== loadGeneration) return false;
      setAssetStatus("warning", "KIT READY · BASIC MOTION", error?.message ?? String(error)); return false;
    }
  }
  function startAssetLoad({ reuseCharacterScene = false } = {}) {
    loadGeneration += 1; const generation = loadGeneration;
    if (visualTestMode) setAssetStatus("ready", "VISUAL TEST · MODEL VIEWS", "Snapshot-driven procedural model validation");
    else void loadAssets(generation, { reuseCharacterScene });
  }
  function attach() {
    if (attached || unavailable() || !isSceneBound()) return false;
    scenePort = getScenePort(); if (!scenePort || typeof scenePort.addObject !== "function") return false;
    ballView = createBallView({ scenePort, document, worldX: world.worldX, worldZ: world.worldZ });
    if (ballView.attach?.() === false) { ballView.teardown?.(); ballView = null; return false; }
    attached = true; startAssetLoad(); return true;
  }
  function render(frame) {
    if (!attached && !unavailable() && isSceneBound()) attach();
    if (!attached || unavailable()) return false;
    if (!frame || !Object.isFrozen(frame) || !Object.isFrozen(frame.snapshot) || !Object.isFrozen(frame.previousSnapshot)) throw new TypeError("model view frame requires immutable snapshots");
    const renderState = createSnapshotRenderState({ previous: frame.previousSnapshot, current: frame.snapshot, alpha: frame.alpha });
    reconcilePlayers(renderState.players);
    const snapshot = frame.snapshot; const ballOwner = snapshot.players.find((player) => player.id === snapshot.ball.ownerId) ?? null; const selectedPlayer = renderState.players.find((player) => player.id === snapshot.match.selectedPlayerId) ?? null;
    for (const player of renderState.players) playerViews.get(player.id)?.render?.({ player, ball: renderState.ball, selectedPlayerId: snapshot.match.selectedPlayerId, ballOwnerId: snapshot.ball.ownerId, ballOwnerTeam: ballOwner?.team ?? null, replayActive: Boolean(snapshot.match.replay?.active), controlMode: frame.controlMode, pressedCodes: frame.pressedCodes ?? Object.freeze([]), nowMilliseconds: frame.nowMilliseconds });
    ballView?.render?.({ ball: renderState.ball, selectedPlayer, selectedPlayerOwnsBall: Boolean(selectedPlayer && snapshot.ball.ownerId === selectedPlayer.id), activeCharge: frame.activeCharge ?? null, ballStyle: snapshot.match.settings?.ballStyle ?? "classic" });
    return true;
  }
  function reset() {
    if (!attached || unavailable()) return false;
    for (const view of playerViews.values()) view.reset?.();
    ballView?.reset?.(); startAssetLoad({ reuseCharacterScene: Boolean(characterScene) }); return true;
  }
  function teardown() {
    if (disposed) return false; const errors = [];
    if (!terminating) { loadGeneration += 1; terminating = true; attached = false; }
    for (const [id, view] of [...playerViews.entries()].reverse()) {
      try { view.teardown?.(); playerViews.delete(id); } catch (error) { errors.push(error); }
    }
    if (playerViews.size === 0 && ballView) {
      try { ballView.teardown?.(); ballView = null; } catch (error) { errors.push(error); }
    }
    if (playerViews.size === 0 && !ballView && characterScene) {
      try { disposePlayerAssetTemplate(characterScene); characterScene = null; } catch (error) { errors.push(error); }
    }
    if (playerViews.size === 0 && !ballView && !characterScene) { animations = Object.freeze([]); scenePort = null; disposed = true; terminating = false; }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "model view teardown reported errors");
    return disposed;
  }
  return Object.freeze({
    attach, render, reset, teardown,
    diagnostics: () => Object.freeze({
      owner: "browser-model-views", attached, disposed, terminating, sceneBound: Boolean(isSceneBound()),
      playerCount: playerViews.size, ballAttached: Boolean(ballView?.diagnostics?.().attached),
      assetState, assetDetail, animationClips: animations.length, loadGeneration,
      projection: Object.freeze({
        profileId: world.profileId ?? null,
        width: Number(world.width ?? DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldWidth),
        height: Number(world.height ?? DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldHeight),
        scale: Number(world.scale ?? DEFAULT_SIMULATION_SCALE_PROFILE.simulation.worldUnitsPerSimulationUnit),
      }),
      appearance: appearanceDiagnostics(playerViews),
    }),
  });
}
