import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const CHARACTER_URL = "assets/models/football-character-v2.glb?v=16.0.0";
const ANIMATION_URL = "assets/models/football-animations-v2.glb?v=16.0.0";

async function loadWithRetry(loader, url, label, { timeoutMilliseconds = 10000, attempts = 2 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const source = attempt === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`;
    try {
      return await Promise.race([loader.loadAsync(source), new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMilliseconds}ms`)), timeoutMilliseconds))]);
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
  return Object.freeze({ loadCharacter: () => loadWithRetry(loader, CHARACTER_URL, "character"), loadAnimations: () => loadWithRetry(loader, ANIMATION_URL, "animations") });
}
