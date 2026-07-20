import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

function abortError() {
  const error = new Error("player model loading aborted");
  error.name = "AbortError";
  return error;
}

function assertActive(signal) {
  if (signal?.aborted) throw abortError();
}

async function loadWithRetry({
  loader,
  url,
  label,
  timeoutMilliseconds,
  attempts,
  signal,
  clock = globalThis,
}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    assertActive(signal);
    const source = attempt === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`;
    let timeoutId = null;
    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = clock.setTimeout(
          () => reject(new Error(`${label} timeout after ${timeoutMilliseconds}ms`)),
          timeoutMilliseconds,
        );
      });
      const result = await Promise.race([loader.loadAsync(source), timeout]);
      assertActive(signal);
      return result;
    } catch (error) {
      lastError = error;
      if (error?.name === "AbortError") throw error;
    } finally {
      if (timeoutId !== null) clock.clearTimeout(timeoutId);
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

export function createBrowserPlayerAssetLoader({
  loaderFactory = () => new GLTFLoader(),
  meshoptDecoder = MeshoptDecoder,
  characterUrl = "assets/models/football-character-v2.glb?v=16.0.0",
  animationUrl = "assets/models/football-animations-v2.glb?v=16.0.0",
  timeoutMilliseconds = 10_000,
  attempts = 2,
  clock = globalThis,
} = {}) {
  if (typeof loaderFactory !== "function") throw new TypeError("loaderFactory must be a function");
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError("attempts must be a positive integer");
  if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
    throw new RangeError("timeoutMilliseconds must be positive");
  }

  return Object.freeze({
    async load({
      signal = null,
      onStatus = () => {},
      onCharacter = () => {},
      onAnimations = () => {},
    } = {}) {
      const loader = loaderFactory();
      if (!loader || typeof loader.loadAsync !== "function") {
        throw new TypeError("player asset loader requires loadAsync");
      }
      loader.setMeshoptDecoder?.(meshoptDecoder);
      onStatus(Object.freeze({
        state: "loading",
        label: "MODEL · LOADING",
        detail: "Đang tải football-character-v2.glb",
      }));
      let character;
      try {
        character = await loadWithRetry({
          loader,
          url: characterUrl,
          label: "character",
          timeoutMilliseconds,
          attempts,
          signal,
          clock,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        onStatus(Object.freeze({
          state: "error",
          label: "MODEL · FALLBACK",
          detail: error?.message ?? String(error),
        }));
        return Object.freeze({ characterLoaded: false, animationsLoaded: false, error });
      }
      assertActive(signal);
      onCharacter(character);
      onStatus(Object.freeze({
        state: "ready",
        label: "MODEL · READY",
        detail: "Character đã tải; animation đang tải nền",
      }));

      try {
        const motion = await loadWithRetry({
          loader,
          url: animationUrl,
          label: "animations",
          timeoutMilliseconds,
          attempts,
          signal,
          clock,
        });
        const animations = Object.freeze([...(motion.animations ?? [])]);
        onAnimations(animations);
        onStatus(Object.freeze({
          state: "ready",
          label: "PLAYER RIG · READY",
          detail: `${animations.length} animation clips`,
        }));
        return Object.freeze({
          characterLoaded: true,
          animationsLoaded: true,
          character,
          animations,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        onStatus(Object.freeze({
          state: "warning",
          label: "MODEL READY · BASIC MOTION",
          detail: error?.message ?? String(error),
        }));
        return Object.freeze({
          characterLoaded: true,
          animationsLoaded: false,
          character,
          animations: Object.freeze([]),
          error,
        });
      }
    },
  });
}
