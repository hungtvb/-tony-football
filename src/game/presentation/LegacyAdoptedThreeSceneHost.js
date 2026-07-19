import { createThreeSceneHostPort } from "./ThreeSceneHostContract.js";

function requireLegacyResources(resources) {
  if (!resources?.renderer || !resources?.scene || !resources?.camera) {
    throw new TypeError("legacy adopted Three scene host requires renderer, scene and camera");
  }
  return resources;
}

function stableDiagnostics(resources, lowPowerDevice) {
  return Object.freeze({
    renderer: "webgl",
    composer: Boolean(resources.composer),
    lowPowerDevice: Boolean(lowPowerDevice),
    adopted: true,
    environmentObjects: resources.environmentObjects?.length ?? 0,
    sceneObjects: resources.scene.children?.length ?? 0,
  });
}

export function createLegacyAdoptedThreeSceneHost({
  legacyResources,
  lowPowerDevice = false,
  renderScope = (callback) => callback(),
} = {}) {
  const resources = requireLegacyResources(legacyResources);
  let started = false;
  let disposed = false;

  function start() {
    if (disposed) throw new Error("legacy adopted Three scene host is disposed");
    if (started) return false;
    started = true;
    return true;
  }

  function resize(viewport) {
    if (!started || disposed) return false;
    const { renderer, camera, composer } = resources;
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix?.();
    renderer.setPixelRatio?.(Math.min(viewport.pixelRatio, lowPowerDevice ? 1.1 : 2));
    renderer.setSize?.(viewport.width, viewport.height, false);
    composer?.setPixelRatio?.(Math.min(viewport.pixelRatio, 2));
    composer?.setSize?.(viewport.width, viewport.height);
    return true;
  }

  function render() {
    if (!started || disposed) return false;
    return renderScope(() => {
      if (resources.composer) resources.composer.render();
      else resources.renderer.render(resources.scene, resources.camera);
      return true;
    });
  }

  function reset() {
    return started && !disposed;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    started = false;
    return true;
  }

  const port = createThreeSceneHostPort({
    addObject: (object) => {
      if (!started || disposed || !object) return false;
      resources.scene.add(object);
      return true;
    },
    removeObject: (object) => {
      if (!started || disposed || !object) return false;
      resources.scene.remove(object);
      return true;
    },
    setCameraPose: (pose) => {
      if (!started || disposed) return false;
      resources.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      resources.camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
      return true;
    },
    copyCameraQuaternion: (destination) => {
      if (!started || disposed || !destination?.copy) return false;
      destination.copy(resources.camera.quaternion);
      return true;
    },
    requestRender: render,
    diagnostics: () => stableDiagnostics(resources, lowPowerDevice),
  });

  return Object.freeze({ port, start, resize, render, reset, dispose });
}
