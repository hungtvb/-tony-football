const REGISTRY_KEY = Symbol.for("tony.football.legacy-three-scene-registry");
const ENVIRONMENT_STACK = /createPitch3D|createPitchDetails3D|createGrass3D|createStadium3D|createLedBoard3D|createAtmosphere3D|applyStadiumLighting/;

function registry() {
  if (!globalThis[REGISTRY_KEY]) {
    globalThis[REGISTRY_KEY] = {
      installed: false,
      renderer: null,
      scene: null,
      camera: null,
      composer: null,
      ownedRenderer: null,
      ownedScene: null,
      environmentObjects: new Set(),
      ownershipActive: false,
      ownedRenderDepth: 0,
      ownedMutationDepth: 0,
      activePort: null,
      restore: [],
    };
  }
  return globalThis[REGISTRY_KEY];
}

function classifyEnvironmentObject(object, stack) {
  if (!object) return false;
  if (ENVIRONMENT_STACK.test(stack)) return true;
  if (/init3D/.test(stack) && object.isLight) return true;
  return false;
}

function patchMethod(prototype, name, wrapper) {
  const original = prototype?.[name];
  if (typeof original !== "function") return;
  prototype[name] = wrapper(original);
  registry().restore.push(() => { prototype[name] = original; });
}

export function installLegacyThreeSceneTracking({ THREE, EffectComposer } = {}) {
  const state = registry();
  if (state.installed) return false;
  if (!THREE?.Scene || !THREE?.WebGLRenderer || !THREE?.PerspectiveCamera || !EffectComposer) {
    throw new TypeError("legacy Three scene tracking requires Three.js and EffectComposer");
  }

  patchMethod(THREE.Scene.prototype, "add", (original) => function trackedSceneAdd(...objects) {
    if (!state.scene) state.scene = this;
    else if (this !== state.scene) state.ownedScene = this;
    if (state.ownedMutationDepth > 0) return original.apply(this, objects);
    const stack = new Error().stack ?? "";
    const forwarded = [];
    for (const object of objects) {
      const environment = classifyEnvironmentObject(object, stack);
      if (this === state.scene && environment) state.environmentObjects.add(object);
      if (state.ownershipActive && state.activePort && this === state.scene && !environment) state.activePort.addObject(object);
      else forwarded.push(object);
    }
    return forwarded.length > 0 ? original.apply(this, forwarded) : this;
  });
  patchMethod(THREE.PerspectiveCamera.prototype, "lookAt", (original) => function trackedCameraLookAt(...args) {
    if (!state.camera) state.camera = this;
    return original.apply(this, args);
  });
  patchMethod(THREE.WebGLRenderer.prototype, "setSize", (original) => function trackedRendererSetSize(...args) {
    if (!state.renderer) state.renderer = this;
    else if (this !== state.renderer) state.ownedRenderer = this;
    return original.apply(this, args);
  });
  patchMethod(THREE.WebGLRenderer.prototype, "render", (original) => function trackedRendererRender(...args) {
    if (!state.renderer) state.renderer = this;
    if (state.ownershipActive && state.ownedRenderDepth === 0) return undefined;
    return original.apply(this, args);
  });
  for (const method of ["setSize", "addPass"]) {
    patchMethod(EffectComposer.prototype, method, (original) => function trackedComposerMethod(...args) {
      if (!state.composer) state.composer = this;
      return original.apply(this, args);
    });
  }
  patchMethod(EffectComposer.prototype, "render", (original) => function trackedComposerRender(...args) {
    if (!state.composer) state.composer = this;
    if (state.ownershipActive && state.ownedRenderDepth === 0) return undefined;
    return original.apply(this, args);
  });
  state.installed = true;
  return true;
}

export function legacyThreeSceneSnapshot() {
  const state = registry();
  if (!state.renderer || !state.scene || !state.camera) return null;
  return Object.freeze({
    renderer: state.renderer,
    scene: state.scene,
    camera: state.camera,
    composer: state.composer,
    environmentObjects: Object.freeze([...state.environmentObjects]),
    legacyObjects: Object.freeze(state.scene.children.filter((object) => !state.environmentObjects.has(object))),
  });
}

export function ownedThreeSceneSnapshot() {
  const state = registry();
  if (!state.ownedRenderer || !state.ownedScene) return null;
  return Object.freeze({ renderer: state.ownedRenderer, scene: state.ownedScene });
}

export function activateLegacyThreeSceneOwnership(port = null) {
  registry().activePort = port;
  registry().ownershipActive = true;
  return true;
}

export function deactivateLegacyThreeSceneOwnership() {
  registry().ownershipActive = false;
  registry().activePort = null;
  return true;
}

export function withLegacyThreeOwnedRender(callback) {
  if (typeof callback !== "function") throw new TypeError("owned render callback must be a function");
  const state = registry();
  state.ownedRenderDepth += 1;
  try {
    return callback();
  } finally {
    state.ownedRenderDepth -= 1;
  }
}

export function withLegacyThreeOwnedMutation(callback) {
  if (typeof callback !== "function") throw new TypeError("owned mutation callback must be a function");
  const state = registry();
  state.ownedMutationDepth += 1;
  try {
    return callback();
  } finally {
    state.ownedMutationDepth -= 1;
  }
}

export function resetLegacyThreeSceneRegistryForTests() {
  const state = registry();
  while (state.restore.length > 0) state.restore.pop()();
  state.installed = false;
  state.renderer = null;
  state.scene = null;
  state.camera = null;
  state.composer = null;
  state.ownedRenderer = null;
  state.ownedScene = null;
  state.environmentObjects.clear();
  state.ownershipActive = false;
  state.activePort = null;
  state.ownedRenderDepth = 0;
  state.ownedMutationDepth = 0;
}
