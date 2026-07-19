function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero`);
  return value;
}

function nonNegative(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be zero or greater`);
  return value;
}

function positivePowerOfTwo(value, name) {
  positive(value, name);
  if (!Number.isInteger(value) || (value & (value - 1)) !== 0) {
    throw new RangeError(`${name} must be a positive power of two`);
  }
  return value;
}

function color(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) {
    throw new RangeError(`${name} must be a 24-bit integer color`);
  }
  return value;
}

function vector3(value, name) {
  if (!value || typeof value !== "object") throw new TypeError(`${name} must be a vector object`);
  for (const axis of ["x", "y", "z"]) finite(value[axis], `${name}.${axis}`);
  return value;
}

function perspectiveFov(value, name) {
  positive(value, name);
  if (value >= 180) throw new RangeError(`${name} must be less than 180 degrees`);
  return value;
}

function shadowBounds(value, name) {
  if (!value || typeof value !== "object") throw new TypeError(`${name} must be an object`);
  for (const edge of ["left", "right", "top", "bottom"]) finite(value[edge], `${name}.${edge}`);
  if (!(value.left < value.right && value.bottom < value.top)) {
    throw new RangeError(`${name} are invalid`);
  }
  return value;
}

const DEFAULT_PROFILE_INPUT = {
  id: "tony-football-default-v1",
  geometry: {
    worldWidth: 1200,
    worldHeight: 700,
    worldScale: 0.1,
    field: { left: 48, right: 1152, top: 42, bottom: 658 },
    goal: { top: 265, bottom: 435, width: 17, height: 3.5, depth: 3 },
  },
  renderer: {
    background: 0x050a09,
    fogColor: 0x07110e,
    fogDensity: 0.011,
    exposure: 1.12,
  },
  camera: {
    fov: 39,
    lowPowerFov: 43,
    near: 0.1,
    far: 260,
    position: { x: 0, y: 45, z: 52 },
    lowPowerPosition: { x: 0, y: 54, z: 63 },
  },
  lighting: {
    hemisphere: { skyColor: 0xcfffe7, groundColor: 0x06120d, intensity: 1.45 },
    flood: {
      color: 0xffffff,
      intensity: 3.4,
      position: { x: -28, y: 62, z: 30 },
      shadowMapSize: 2048,
      lowPowerShadowMapSize: 512,
      shadowBounds: { left: -72, right: 72, top: 50, bottom: -50 },
      shadowBias: -0.00035,
    },
    rim: { color: 0x70dcff, intensity: 1.4, position: { x: 48, y: 25, z: -35 } },
    stadium: { intensity: 20 },
  },
  pitchStyles: {
    classic: {
      top: "#0b7547", mid: "#087044", bottom: "#075d39", outside: "#07100d",
      grass: 0x15915b, tint: 0xffffff, wet: 0xb7d8c8,
      environment: { background: 0x07100d, fogColor: 0x07110e, exposure: 1.12, hemisphere: 1.45, flood: 3.4, rim: 1.4, stadium: 20 },
    },
    elite: {
      top: "#11915b", mid: "#0b8351", bottom: "#086b43", outside: "#07140f",
      grass: 0x20a869, tint: 0xf2fff8, wet: 0xa8d8c4,
      environment: { background: 0x07100d, fogColor: 0x07110e, exposure: 1.12, hemisphere: 1.45, flood: 3.4, rim: 1.4, stadium: 20 },
    },
    dry: {
      top: "#8b9c4d", mid: "#74883e", bottom: "#637537", outside: "#16170d",
      grass: 0x879d4c, tint: 0xfff1cc, wet: 0xb8c39a,
      environment: { background: 0x07100d, fogColor: 0x07110e, exposure: 1.12, hemisphere: 1.45, flood: 3.4, rim: 1.4, stadium: 20 },
    },
    midnight: {
      top: "#075943", mid: "#064b38", bottom: "#043d2e", outside: "#030c09",
      grass: 0x08795a, tint: 0xc4e9dc, wet: 0x86b8a9,
      environment: { background: 0x020708, fogColor: 0x030908, exposure: 1.22, hemisphere: 1.05, flood: 4.35, rim: 1.85, stadium: 30 },
    },
  },
};

function cloneProfile(input) {
  return {
    id: String(input.id),
    geometry: {
      worldWidth: input.geometry.worldWidth,
      worldHeight: input.geometry.worldHeight,
      worldScale: input.geometry.worldScale,
      field: { ...input.geometry.field },
      goal: { ...input.geometry.goal },
    },
    renderer: { ...input.renderer },
    camera: {
      ...input.camera,
      position: { ...input.camera.position },
      lowPowerPosition: { ...input.camera.lowPowerPosition },
    },
    lighting: {
      hemisphere: { ...input.lighting.hemisphere },
      flood: {
        ...input.lighting.flood,
        position: { ...input.lighting.flood.position },
        shadowBounds: { ...input.lighting.flood.shadowBounds },
      },
      rim: { ...input.lighting.rim, position: { ...input.lighting.rim.position } },
      stadium: { ...input.lighting.stadium },
    },
    pitchStyles: Object.fromEntries(Object.entries(input.pitchStyles).map(([name, style]) => [name, {
      ...style,
      environment: { ...style.environment },
    }])),
  };
}

export function createThreeSceneEnvironmentProfile(input = DEFAULT_PROFILE_INPUT) {
  if (!input || typeof input !== "object") throw new TypeError("Three scene environment profile must be an object");
  const profile = cloneProfile(input);
  if (!profile.id) throw new TypeError("Three scene environment profile requires an id");

  const geometry = profile.geometry;
  positive(geometry.worldWidth, "geometry.worldWidth");
  positive(geometry.worldHeight, "geometry.worldHeight");
  positive(geometry.worldScale, "geometry.worldScale");
  const { field, goal } = geometry;
  for (const [name, value] of Object.entries(field)) finite(value, `geometry.field.${name}`);
  if (!(field.left < field.right && field.top < field.bottom)) throw new RangeError("field bounds are invalid");
  for (const [name, value] of Object.entries(goal)) finite(value, `geometry.goal.${name}`);
  if (!(goal.top < goal.bottom)) throw new RangeError("goal mouth bounds are invalid");
  positive(goal.width, "geometry.goal.width");
  positive(goal.height, "geometry.goal.height");
  positive(goal.depth, "geometry.goal.depth");

  color(profile.renderer.background, "renderer.background");
  color(profile.renderer.fogColor, "renderer.fogColor");
  nonNegative(profile.renderer.fogDensity, "renderer.fogDensity");
  positive(profile.renderer.exposure, "renderer.exposure");

  perspectiveFov(profile.camera.fov, "camera.fov");
  perspectiveFov(profile.camera.lowPowerFov, "camera.lowPowerFov");
  positive(profile.camera.near, "camera.near");
  positive(profile.camera.far, "camera.far");
  if (profile.camera.near >= profile.camera.far) throw new RangeError("camera near must be less than far");
  vector3(profile.camera.position, "camera.position");
  vector3(profile.camera.lowPowerPosition, "camera.lowPowerPosition");

  const { hemisphere, flood, rim, stadium } = profile.lighting;
  color(hemisphere.skyColor, "lighting.hemisphere.skyColor");
  color(hemisphere.groundColor, "lighting.hemisphere.groundColor");
  nonNegative(hemisphere.intensity, "lighting.hemisphere.intensity");
  color(flood.color, "lighting.flood.color");
  nonNegative(flood.intensity, "lighting.flood.intensity");
  vector3(flood.position, "lighting.flood.position");
  positivePowerOfTwo(flood.shadowMapSize, "lighting.flood.shadowMapSize");
  positivePowerOfTwo(flood.lowPowerShadowMapSize, "lighting.flood.lowPowerShadowMapSize");
  shadowBounds(flood.shadowBounds, "lighting.flood.shadowBounds");
  finite(flood.shadowBias, "lighting.flood.shadowBias");
  color(rim.color, "lighting.rim.color");
  nonNegative(rim.intensity, "lighting.rim.intensity");
  vector3(rim.position, "lighting.rim.position");
  nonNegative(stadium.intensity, "lighting.stadium.intensity");

  if (!profile.pitchStyles.classic) throw new TypeError("profile requires a classic pitch style");
  for (const [styleName, style] of Object.entries(profile.pitchStyles)) {
    for (const key of ["top", "mid", "bottom", "outside"]) {
      if (typeof style[key] !== "string" || style[key].length === 0) throw new TypeError(`pitchStyles.${styleName}.${key} must be a CSS color`);
    }
    for (const key of ["grass", "tint", "wet"]) color(style[key], `pitchStyles.${styleName}.${key}`);
    for (const key of ["background", "fogColor"]) color(style.environment[key], `pitchStyles.${styleName}.environment.${key}`);
    positive(style.environment.exposure, `pitchStyles.${styleName}.environment.exposure`);
    for (const key of ["hemisphere", "flood", "rim", "stadium"]) {
      nonNegative(style.environment[key], `pitchStyles.${styleName}.environment.${key}`);
    }
  }

  return deepFreeze(profile);
}

export const DEFAULT_THREE_SCENE_ENVIRONMENT_PROFILE = createThreeSceneEnvironmentProfile();
