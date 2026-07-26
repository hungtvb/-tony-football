import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const CHARACTER_URL = "assets/models/football-character-v2.glb?v=16.0.0";
const ANIMATION_URL = "assets/models/football-animations-v2.glb?v=16.0.0";

// GLTFLoader.loadAsync resolves only after fetch, decode and scene construction.
// A 30 second wall-clock budget still false-falls back on software WebGL runners
// after a complete local 200 response while Meshopt/GLB parsing is finishing.
// Keep each attempt bounded and preserve retry, but allow one slow decode to settle.
export const PLAYER_ASSET_ATTEMPT_TIMEOUT_MILLISECONDS = 45000;

function disposeLateAsset(result) {
  disposePlayerAssetTemplate(result?.scene);
}

export async function loadPlayerAssetWithRetry(loader, url, label, { timeoutMilliseconds = PLAYER_ASSET_ATTEMPT_TIMEOUT_MILLISECONDS, attempts = 2, setTimer = setTimeout, clearTimer = clearTimeout, disposeLateResult = disposeLateAsset } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const source = attempt === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`;
    try {
      return await new Promise((resolve, reject) => {
        let settled = false;
        let timeoutHandle = setTimer(() => {
          if (settled) return;
          settled = true;
          const handle = timeoutHandle;
          timeoutHandle = null;
          if (handle !== null) clearTimer(handle);
          reject(new Error(`${label} timeout after ${timeoutMilliseconds}ms`));
        }, timeoutMilliseconds);
        Promise.resolve()
          .then(() => loader.loadAsync(source))
          .then(
            (result) => {
              if (settled) {
                disposeLateResult(result);
                return;
              }
              settled = true;
              const handle = timeoutHandle;
              timeoutHandle = null;
              if (handle !== null) clearTimer(handle);
              resolve(result);
            },
            (error) => {
              if (settled) return;
              settled = true;
              const handle = timeoutHandle;
              timeoutHandle = null;
              if (handle !== null) clearTimer(handle);
              reject(error);
            },
          );
      });
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error(`${label} failed`);
}

export function disposePlayerAssetTemplate(scene) {
  scene?.traverse?.((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      for (const key of ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "alphaMap"]) material[key]?.dispose?.();
      material.dispose?.();
    }
  });
}

export function createDefaultPlayerAssetLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return Object.freeze({ loadCharacter: () => loadPlayerAssetWithRetry(loader, CHARACTER_URL, "character"), loadAnimations: () => loadPlayerAssetWithRetry(loader, ANIMATION_URL, "animations") });
}
