function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}

export function createThreeSceneHostPort({
  addObject,
  removeObject,
  setCameraPose,
  copyCameraQuaternion,
  requestRender,
  diagnostics = () => Object.freeze({}),
} = {}) {
  assertFunction(addObject, "addObject");
  assertFunction(removeObject, "removeObject");
  assertFunction(setCameraPose, "setCameraPose");
  assertFunction(copyCameraQuaternion, "copyCameraQuaternion");
  assertFunction(requestRender, "requestRender");
  assertFunction(diagnostics, "diagnostics");

  return Object.freeze({
    addObject(object) {
      return addObject(object);
    },

    removeObject(object) {
      return removeObject(object);
    },

    setCameraPose(pose) {
      if (!pose || typeof pose !== "object" || !Object.isFrozen(pose)) {
        throw new TypeError("camera pose must be an immutable object");
      }
      return setCameraPose(pose);
    },

    copyCameraQuaternion(target) {
      return copyCameraQuaternion(target);
    },

    requestRender() {
      return requestRender();
    },

    diagnostics() {
      const value = diagnostics();
      if (!value || typeof value !== "object" || !Object.isFrozen(value)) {
        throw new TypeError("scene host diagnostics must be an immutable object");
      }
      return value;
    },
  });
}
