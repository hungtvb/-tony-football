import { createThreeSceneHostPort } from "./ThreeSceneHostContract.js";

const REQUIRED_PORT_METHODS = Object.freeze([
  "addObject",
  "removeObject",
  "setCameraPose",
  "copyCameraQuaternion",
  "requestRender",
  "diagnostics",
]);

function assertDelegate(port) {
  if (!port || typeof port !== "object" || !Object.isFrozen(port)) {
    throw new TypeError("scene host delegate must be a frozen object");
  }
  for (const method of REQUIRED_PORT_METHODS) {
    if (typeof port[method] !== "function") throw new TypeError(`scene host delegate ${method} must be a function`);
  }
  return port;
}

function rollbackObjects(port, objects) {
  const errors = [];
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    try {
      port.removeObject(objects[index]);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

export function createRebindableThreeSceneHostPort({
  detachedDiagnostics = () => Object.freeze({
    owner: "canvas-fallback",
    renderer: "canvas",
    profile: null,
    foreignObjects: 0,
  }),
} = {}) {
  if (typeof detachedDiagnostics !== "function") throw new TypeError("detachedDiagnostics must be a function");

  const retainedObjects = new Set();
  let delegate = null;
  let latestCameraPose = null;
  let bindGeneration = 0;

  const port = createThreeSceneHostPort({
    addObject: (object) => {
      if (!object) return false;
      if (retainedObjects.has(object)) return true;
      if (delegate && delegate.addObject(object) === false) return false;
      retainedObjects.add(object);
      return true;
    },
    removeObject: (object) => {
      if (!object || !retainedObjects.has(object)) return false;
      if (delegate && delegate.removeObject(object) === false) return false;
      retainedObjects.delete(object);
      return true;
    },
    setCameraPose: (pose) => {
      latestCameraPose = pose;
      return delegate ? delegate.setCameraPose(pose) : false;
    },
    copyCameraQuaternion: (target) => delegate ? delegate.copyCameraQuaternion(target) : false,
    requestRender: () => delegate ? delegate.requestRender() : false,
    diagnostics: () => {
      const source = delegate ? delegate.diagnostics() : detachedDiagnostics();
      if (!source || typeof source !== "object" || !Object.isFrozen(source)) {
        throw new TypeError("scene host facade diagnostics source must be immutable");
      }
      return Object.freeze({
        ...source,
        stablePort: true,
        bound: Boolean(delegate),
        retainedForeignObjects: retainedObjects.size,
        bindGeneration,
      });
    },
  });

  function bind(nextPort) {
    if (nextPort == null) {
      const changed = delegate !== null;
      delegate = null;
      return changed;
    }
    const candidate = assertDelegate(nextPort);
    if (candidate === delegate) return false;

    const replayed = [];
    try {
      for (const object of retainedObjects) {
        if (candidate.addObject(object) === false) throw new Error("scene host delegate rejected retained object during rebind");
        replayed.push(object);
      }
      if (latestCameraPose && candidate.setCameraPose(latestCameraPose) === false) {
        throw new Error("scene host delegate rejected retained camera pose during rebind");
      }
    } catch (error) {
      const rollbackErrors = rollbackObjects(candidate, replayed);
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], "scene host rebind failed and rollback reported errors", { cause: error });
      }
      throw error;
    }

    delegate = candidate;
    bindGeneration += 1;
    return true;
  }

  return Object.freeze({
    port,
    bind,
    get bound() { return delegate !== null; },
    get retainedObjectCount() { return retainedObjects.size; },
    get generation() { return bindGeneration; },
  });
}
