import { createSnapshotRenderState } from "./SnapshotRenderState.js";
import { createPlayerModelView } from "./PlayerModelView.js";
import { createBallModelView } from "./BallModelView.js";
import { createDefaultPlayerAssetLoader, disposePlayerAssetTemplate } from "./PlayerAssetLoader.js";

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}
function defaultVisualTestMode(target) {
  return new URLSearchParams(target?.location?.search ?? "").get("visualTest") === "1";
}
function defaultLowPowerDevice(target) {
  return defaultVisualTestMode(target) || (target?.matchMedia?.("(pointer: coarse)")?.matches ?? false) || Number(target?.navigator?.deviceMemory ?? Infinity) <= 4;
}
function createWorldProjection({ width = 1200, height = 700, scale = 0.1 } = {}) {
  return Object.freeze({ worldX: (value) => (value - width / 2) * scale, worldZ: (value) => (value - height / 2) * scale });
}

export function createBrowserModelViewAdapter({ target, document, getScenePort, isSceneBound = () => Boolean(getScenePort?.()), createPlayerView = createPlayerModelView, createBallView = createBallModelView, assetLoader = createDefaultPlayerAssetLoader(), visualTestMode = defaultVisualTestMode(target), lowPowerDevice = defaultLowPowerDevice(target), world = createWorldProjection() } = {}) {
  if (!target || typeof target !== "object") throw new TypeError("BrowserModelViewAdapter requires a target");
  if (!document || typeof document.getElementById !== "function" || typeof document.createElement !== "function") throw new TypeError("BrowserModelViewAdapter requires a document");
  assertFunction(getScenePort, "getScenePort"); assertFunction(isSceneBound, "isSceneBound"); assertFunction(createPlayerView, "createPlayerView"); assertFunction(createBallView, "createBallView");
  assertFunction(assetLoader?.loadCharacter, "assetLoader.loadCharacter"); assertFunction(assetLoader?.loadAnimations, "assetLoader.loadAnimations"); assertFunction(world?.worldX, "world.worldX"); assertFunction(world?.worldZ, "world.worldZ");

  const playerViews = new Map();
  let scenePort = null; let ballView = null; let characterScene = null; let animations = Object.freeze([]);
  let attached = false; let disposed = false; let loadGeneration = 0; let assetState = "idle"; let assetDetail = "";

  function setAssetStatus(state, label, detail = "") {
    assetState = state; assetDetail = detail;
    const status = Object.freeze({ state, label, detail, updatedAt: new Date().toISOString() }); target.__playerAssetStatus = status;
    const badge = document.getElementById("assetStatus");
    if (badge) { badge.className = `asset-status ${state}`; badge.textContent = label; badge.title = detail; }
    return status;
  }
  function createView(player) {
    const view = createPlayerView({ player, scenePort, document, worldX: world.worldX, worldZ: world.worldZ, lowPowerDevice });
    if (view.attach?.() === false) { view.teardown?.(); throw new Error(`player model view ${player.id} rejected scene attachment`); }
    if (characterScene) view.installAsset?.({ characterScene, animations });
    playerViews.set(player.id, view); return view;
  }
  function reconcilePlayers(players) {
    const activeIds = new Set(players.map((player) => player.id));
    for (const [id, view] of playerViews) { if (activeIds.has(id)) continue; view.teardown?.(); playerViews.delete(id); }
    for (const player of players) if (!playerViews.has(player.id)) createView(player);
  }
  async function loadAssets(generation) {
    setAssetStatus("loading", "MODEL · LOADING", "Loading football-character-v2.glb");
    try {
      const character = await assetLoader.loadCharacter();
      if (disposed || generation !== loadGeneration) { disposePlayerAssetTemplate(character?.scene); return false; }
      characterScene = character?.scene ?? null; if (!characterScene) throw new Error("character asset has no scene");
      for (const view of playerViews.values()) view.installAsset?.({ characterScene, animations });
      setAssetStatus("ready", "MODEL · READY", "Character loaded; animation loading in background");
    } catch (error) {
      if (disposed || generation !== loadGeneration) return false;
      setAssetStatus("error", "MODEL · FALLBACK", error?.message ?? String(error)); return false;
    }
    try {
      const motion = await assetLoader.loadAnimations();
      if (disposed || generation !== loadGeneration) return false;
      animations = Object.freeze([...(motion?.animations ?? [])]);
      for (const view of playerViews.values()) view.installAnimations?.(animations);
      setAssetStatus("ready", "PLAYER RIG · READY", `${animations.length} animation clips`); return true;
    } catch (error) {
      if (disposed || generation !== loadGeneration) return false;
      setAssetStatus("warning", "MODEL READY · BASIC MOTION", error?.message ?? String(error)); return false;
    }
  }
  function attach() {
    if (attached || disposed || !isSceneBound()) return false;
    scenePort = getScenePort(); if (!scenePort || typeof scenePort.addObject !== "function") return false;
    ballView = createBallView({ scenePort, document, worldX: world.worldX, worldZ: world.worldZ });
    if (ballView.attach?.() === false) { ballView.teardown?.(); ballView = null; return false; }
    attached = true; loadGeneration += 1;
    if (visualTestMode) setAssetStatus("ready", "VISUAL TEST · MODEL VIEWS", "Snapshot-driven procedural model validation"); else void loadAssets(loadGeneration);
    return true;
  }
  function render(frame) {
    if (!attached && !disposed && isSceneBound()) attach();
    if (!attached || disposed) return false;
    if (!frame || !Object.isFrozen(frame) || !Object.isFrozen(frame.snapshot) || !Object.isFrozen(frame.previousSnapshot)) throw new TypeError("model view frame requires immutable snapshots");
    const renderState = createSnapshotRenderState({ previous: frame.previousSnapshot, current: frame.snapshot, alpha: frame.alpha });
    reconcilePlayers(renderState.players);
    const snapshot = frame.snapshot; const ballOwner = snapshot.players.find((player) => player.id === snapshot.ball.ownerId) ?? null; const selectedPlayer = renderState.players.find((player) => player.id === snapshot.match.selectedPlayerId) ?? null;
    for (const player of renderState.players) playerViews.get(player.id)?.render?.({ player, ball: renderState.ball, selectedPlayerId: snapshot.match.selectedPlayerId, ballOwnerId: snapshot.ball.ownerId, ballOwnerTeam: ballOwner?.team ?? null, replayActive: Boolean(snapshot.match.replay?.active), controlMode: frame.controlMode, pressedCodes: frame.pressedCodes ?? Object.freeze([]), nowMilliseconds: frame.nowMilliseconds });
    ballView?.render?.({ ball: renderState.ball, selectedPlayer, selectedPlayerOwnsBall: Boolean(selectedPlayer && snapshot.ball.ownerId === selectedPlayer.id), activeCharge: frame.activeCharge ?? null, ballStyle: snapshot.match.settings?.ballStyle ?? "classic" });
    return true;
  }
  function reset() { if (!attached || disposed) return false; for (const view of playerViews.values()) view.reset?.(); ballView?.reset?.(); return true; }
  function teardown() {
    if (disposed) return false; loadGeneration += 1; disposed = true; attached = false; const errors = [];
    for (const view of [...playerViews.values()].reverse()) { try { view.teardown?.(); } catch (error) { errors.push(error); } }
    playerViews.clear(); try { ballView?.teardown?.(); } catch (error) { errors.push(error); }
    ballView = null; disposePlayerAssetTemplate(characterScene); characterScene = null; animations = Object.freeze([]); scenePort = null;
    if (errors.length === 1) throw errors[0]; if (errors.length > 1) throw new AggregateError(errors, "model view teardown reported errors"); return true;
  }
  return Object.freeze({ attach, render, reset, teardown, diagnostics: () => Object.freeze({ owner: "browser-model-views", attached, disposed, sceneBound: Boolean(isSceneBound()), playerCount: playerViews.size, ballAttached: Boolean(ballView?.diagnostics?.().attached), assetState, assetDetail, animationClips: animations.length }) });
}
