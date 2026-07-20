import * as THREE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

import { createSnapshotRenderState } from "./SnapshotRenderState.js";
import { createBallModelView } from "./BallModelView.js";
import { createBrowserPlayerAssetLoader } from "./BrowserPlayerAssetLoader.js";
import { createPlayerModelView } from "./PlayerModelView.js";

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}

function defaultLowPowerDevice(target) {
  const visualTestMode = new URLSearchParams(target?.location?.search ?? "").get("visualTest") === "1";
  const coarsePointer = target?.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const constrainedMemory = Number(target?.navigator?.deviceMemory ?? Infinity) <= 4;
  return visualTestMode || coarsePointer || constrainedMemory;
}

function defaultVisualTestMode(target) {
  return new URLSearchParams(target?.location?.search ?? "").get("visualTest") === "1";
}

function freezeFacts(value) {
  return Object.freeze({
    ...value,
    pressedCodes: Object.freeze([...(value.pressedCodes ?? [])]),
  });
}

function assetStatus(document, status) {
  const node = document?.getElementById?.("assetStatus");
  if (node) {
    node.className = `asset-status ${status.state}`;
    node.textContent = status.label;
    node.title = status.detail ?? "";
  }
  const commentary = document?.getElementById?.("commentary");
  if (!commentary) return;
  if (status.label === "MODEL · FALLBACK") commentary.textContent = "Không tải được model 3D · Đang dùng cầu thủ procedural";
  else if (status.label === "MODEL · READY") commentary.textContent = "PLAYER MODEL ONLINE · LOADING MOTION";
  else if (status.label === "PLAYER RIG · READY") commentary.textContent = `PLAYER RIG ONLINE · ${status.detail}`;
  else if (status.label === "MODEL READY · BASIC MOTION") commentary.textContent = "Model 3D đã tải · Animation fallback đang hoạt động";
}

function disposeLoadedCharacter(value) {
  value?.scene?.traverse?.((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"]) {
        material[key]?.dispose?.();
      }
      material.dispose?.();
    }
  });
}

function createDefaultPlayerView(options) {
  return createPlayerModelView({
    THREE,
    cloneSkeleton,
    ...options,
  });
}

function createDefaultBallView(options) {
  return createBallModelView({
    THREE,
    ...options,
  });
}

export function createBrowserModelViewAdapter({
  target,
  document,
  getScenePort,
  lowPowerDevice = defaultLowPowerDevice(target),
  visualTestMode = defaultVisualTestMode(target),
  canvasMode = new URLSearchParams(target?.location?.search ?? "").get("renderer") === "canvas",
  assetLoader = createBrowserPlayerAssetLoader(),
  createPlayerView = createDefaultPlayerView,
  createBallView = createDefaultBallView,
} = {}) {
  assertFunction(getScenePort, "getScenePort");
  assertFunction(createPlayerView, "createPlayerView");
  assertFunction(createBallView, "createBallView");
  if (!document || typeof document.getElementById !== "function") {
    throw new TypeError("BrowserModelViewAdapter requires a document");
  }
  if (!assetLoader || typeof assetLoader.load !== "function") {
    throw new TypeError("BrowserModelViewAdapter requires an asset loader");
  }

  const playerViews = new Map();
  let ballView = null;
  let scenePort = null;
  let attached = false;
  let disposed = false;
  let generation = 0;
  let character = null;
  let animations = Object.freeze([]);
  let assetState = canvasMode ? "canvas" : visualTestMode ? "procedural" : "idle";
  let assetDetail = "";
  let lastTick = null;
  let lastError = null;
  let abortController = null;

  function diagnostics() {
    let riggedPlayers = 0;
    for (const view of playerViews.values()) {
      if (view.diagnostics?.().rigged) riggedPlayers += 1;
    }
    return Object.freeze({
      owner: "browser-model-view-adapter",
      attached,
      disposed,
      assetState,
      assetDetail,
      playerCount: playerViews.size,
      riggedPlayers,
      ballReady: Boolean(ballView),
      lastTick,
      error: lastError ? String(lastError.message ?? lastError) : null,
    });
  }

  function handleStatus(status) {
    if (!status || !Object.isFrozen(status)) throw new TypeError("model asset status must be immutable");
    assetState = status.state;
    assetDetail = status.detail ?? "";
    assetStatus(document, status);
  }

  function installCharacterOnView(view) {
    if (!character) return false;
    return view.installCharacter?.({ scene: character.scene, animations }) ?? false;
  }

  function loadAssets() {
    if (canvasMode || visualTestMode || !attached) {
      handleStatus(Object.freeze({
        state: canvasMode ? "warning" : "ready",
        label: canvasMode ? "CANVAS · MODEL VIEWS OFF" : "VISUAL TEST · MODEL VIEWS",
        detail: canvasMode ? "Canvas renderer owns compatibility player and ball drawing" : "Procedural snapshot-driven validation",
      }));
      assetState = canvasMode ? "canvas" : "procedural";
      return;
    }
    abortController = new AbortController();
    const activeGeneration = generation;
    Promise.resolve(assetLoader.load({
      signal: abortController.signal,
      onStatus: (status) => {
        if (!attached || generation !== activeGeneration) return;
        handleStatus(status);
      },
      onCharacter: (value) => {
        if (!attached || generation !== activeGeneration) return;
        character = value;
        for (const view of playerViews.values()) installCharacterOnView(view);
      },
      onAnimations: (value) => {
        if (!attached || generation !== activeGeneration) return;
        animations = Object.freeze([...(value ?? [])]);
        for (const view of playerViews.values()) view.installAnimations?.(animations);
      },
    })).catch((error) => {
      if (error?.name === "AbortError") return;
      if (!attached || generation !== activeGeneration) return;
      lastError = error;
      handleStatus(Object.freeze({
        state: "error",
        label: "MODEL · FALLBACK",
        detail: error?.message ?? String(error),
      }));
    });
  }

  function ensureScenePort() {
    if (scenePort) return scenePort;
    const resolved = getScenePort();
    if (!resolved || typeof resolved.addObject !== "function" || typeof resolved.removeObject !== "function") {
      return null;
    }
    scenePort = resolved;
    return scenePort;
  }

  function ensureBallView() {
    if (ballView) return ballView;
    const port = ensureScenePort();
    if (!port) return null;
    ballView = createBallView({ document, scenePort: port, lowPowerDevice });
    return ballView;
  }

  function createView(player) {
    const port = ensureScenePort();
    if (!port) return null;
    const view = createPlayerView({
      document,
      scenePort: port,
      player,
      lowPowerDevice,
    });
    if (!view || typeof view.render !== "function" || typeof view.teardown !== "function") {
      throw new TypeError("createPlayerView must return a player view");
    }
    playerViews.set(player.id, view);
    installCharacterOnView(view);
    return view;
  }

  function reconcilePlayers(snapshot) {
    const activeIds = new Set(snapshot.players.map((player) => player.id));
    for (const [playerId, view] of playerViews) {
      if (activeIds.has(playerId)) continue;
      view.teardown();
      playerViews.delete(playerId);
    }
    for (const player of snapshot.players) {
      if (!playerViews.has(player.id)) createView(player);
    }
  }

  function attach() {
    if (attached) return false;
    attached = true;
    disposed = false;
    generation += 1;
    loadAssets();
    return true;
  }

  function render(frame) {
    if (!attached || disposed || canvasMode) return false;
    if (!frame?.snapshot || !Object.isFrozen(frame.snapshot)) {
      throw new TypeError("model view adapter requires an immutable snapshot frame");
    }
    if (!ensureScenePort()) return false;
    const state = createSnapshotRenderState({
      previous: frame.previousSnapshot ?? frame.snapshot,
      current: frame.snapshot,
      alpha: frame.alpha,
    });
    reconcilePlayers(frame.snapshot);
    ensureBallView();
    const currentPlayers = new Map(frame.snapshot.players.map((player) => [player.id, player]));
    const renderPlayers = new Map(state.players.map((player) => [player.id, player]));
    const selectedId = frame.snapshot.match.selectedPlayerId;
    const selectedPose = selectedId ? renderPlayers.get(selectedId) ?? null : null;
    const ballOwner = frame.snapshot.players.find((player) => player.id === frame.snapshot.ball.ownerId) ?? null;
    for (const [playerId, view] of playerViews) {
      const pose = renderPlayers.get(playerId);
      const current = currentPlayers.get(playerId);
      if (!pose || !current) continue;
      view.render(pose, freezeFacts({
        playerId,
        selected: playerId === selectedId,
        replayActive: Boolean(frame.snapshot.match.replay?.active),
        ball: state.ball,
        ballOwnerId: frame.snapshot.ball.ownerId ?? null,
        ballOwnerTeam: ballOwner?.team ?? null,
        team: current.team,
        controlMode: frame.controlMode ?? "attack",
        pressedCodes: frame.pressedCodes ?? [],
        nowMilliseconds: frame.nowMilliseconds,
      }));
    }
    ballView.render({
      ball: state.ball,
      selectedPlayer: selectedPose,
      ballOwnerId: frame.snapshot.ball.ownerId ?? null,
      activeCharge: frame.activeCharge ?? null,
      ballStyle: frame.snapshot.match.settings?.ballStyle ?? "classic",
    });
    lastTick = frame.snapshot.tick;
    return true;
  }

  function reset() {
    if (!attached || disposed) return false;
    const errors = [];
    for (const view of playerViews.values()) {
      try { view.reset?.(); } catch (error) { errors.push(error); }
    }
    try { ballView?.reset?.(); } catch (error) { errors.push(error); }
    lastTick = null;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "model view reset failed");
    return true;
  }

  function teardown() {
    if (!attached) return false;
    attached = false;
    disposed = true;
    generation += 1;
    abortController?.abort();
    abortController = null;
    const errors = [];
    for (const view of [...playerViews.values()].reverse()) {
      try { view.teardown(); } catch (error) { errors.push(error); }
    }
    playerViews.clear();
    try { ballView?.teardown?.(); } catch (error) { errors.push(error); }
    ballView = null;
    scenePort = null;
    disposeLoadedCharacter(character);
    character = null;
    animations = Object.freeze([]);
    lastTick = null;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "model view teardown failed");
    return true;
  }

  return Object.freeze({
    attach,
    render,
    reset,
    teardown,
    diagnostics,
  });
}
