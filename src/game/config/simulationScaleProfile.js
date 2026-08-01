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

function profileId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("Simulation scale profile requires a non-empty string id");
  }
  return value.trim();
}

function cloneInput(input) {
  return {
    id: profileId(input.id),
    simulation: { ...input.simulation },
    field: {
      ...input.field,
      bounds: { ...input.field.bounds },
      markings: { ...input.field.markings },
    },
    goal: { ...input.goal },
    player: { ...input.player },
    ball: { ...input.ball },
  };
}

const DEFAULT_INPUT = {
  id: "mini-6v6-metric-v1",
  simulation: {
    worldWidth: 1200,
    worldHeight: 700,
    unitsPerMetre: 20,
    worldUnitsPerMetre: 1,
  },
  field: {
    bounds: { left: 48, right: 1152, top: 42, bottom: 658 },
    markings: {
      centreCircleRadiusMetres: 5,
      centreSpotRadiusMetres: 0.15,
      penaltyAreaDepthMetres: 10,
      penaltyAreaWidthMetres: 22,
      goalAreaDepthMetres: 4,
      goalAreaWidthMetres: 10,
      penaltyMarkDistanceMetres: 8,
      lineWidthMetres: 0.1,
    },
  },
  goal: {
    mouthWidthMetres: 5,
    crossbarHeightMetres: 2,
    depthMetres: 1.5,
    postThicknessMetres: 0.1,
  },
  player: {
    representativeHeightMetres: 1.8,
    collisionRadiusMetres: 0.32,
    goalkeeperCollisionRadiusMetres: 0.36,
  },
  ball: {
    radiusMetres: 0.11,
  },
};

function scaleMetres(value, unitsPerMetre) {
  return value * unitsPerMetre;
}

export function createSimulationScaleProfile(input = DEFAULT_INPUT) {
  if (!input || typeof input !== "object") throw new TypeError("Simulation scale profile must be an object");
  const source = cloneInput(input);

  const { simulation, field, goal, player, ball } = source;
  positive(simulation.worldWidth, "simulation.worldWidth");
  positive(simulation.worldHeight, "simulation.worldHeight");
  positive(simulation.unitsPerMetre, "simulation.unitsPerMetre");
  positive(simulation.worldUnitsPerMetre, "simulation.worldUnitsPerMetre");

  for (const [name, value] of Object.entries(field.bounds)) finite(value, `field.bounds.${name}`);
  if (!(field.bounds.left < field.bounds.right && field.bounds.top < field.bounds.bottom)) {
    throw new RangeError("field bounds are invalid");
  }
  if (field.bounds.left < 0 || field.bounds.top < 0
    || field.bounds.right > simulation.worldWidth
    || field.bounds.bottom > simulation.worldHeight) {
    throw new RangeError("field bounds must remain inside the simulation world");
  }
  for (const [name, value] of Object.entries(field.markings)) positive(value, `field.markings.${name}`);

  for (const [name, value] of Object.entries(goal)) positive(value, `goal.${name}`);
  for (const [name, value] of Object.entries(player)) positive(value, `player.${name}`);
  positive(ball.radiusMetres, "ball.radiusMetres");
  if (goal.postThicknessMetres >= goal.mouthWidthMetres) {
    throw new RangeError("goal post thickness must be smaller than the mouth width");
  }
  if (ball.radiusMetres * 2 >= goal.crossbarHeightMetres) {
    throw new RangeError("ball diameter must be smaller than the crossbar height");
  }

  const unitsPerMetre = simulation.unitsPerMetre;
  const worldUnitsPerSimulationUnit = simulation.worldUnitsPerMetre / unitsPerMetre;
  const fieldWidthSimulation = field.bounds.right - field.bounds.left;
  const fieldHeightSimulation = field.bounds.bottom - field.bounds.top;
  const fieldCentreX = (field.bounds.left + field.bounds.right) / 2;
  const fieldCentreY = (field.bounds.top + field.bounds.bottom) / 2;
  const goalMouthWidthSimulation = scaleMetres(goal.mouthWidthMetres, unitsPerMetre);
  const goalPostThicknessSimulation = scaleMetres(goal.postThicknessMetres, unitsPerMetre);
  const ballRadiusSimulation = scaleMetres(ball.radiusMetres, unitsPerMetre);
  const frameWidthMetres = goal.mouthWidthMetres + goal.postThicknessMetres;
  const mouthTop = fieldCentreY - goalMouthWidthSimulation / 2;
  const mouthBottom = fieldCentreY + goalMouthWidthSimulation / 2;

  if (goalMouthWidthSimulation >= fieldHeightSimulation) {
    throw new RangeError("goal mouth must be narrower than the field");
  }

  const profile = {
    id: source.id,
    simulation: {
      ...simulation,
      worldUnitsPerSimulationUnit,
    },
    field: {
      bounds: field.bounds,
      centre: { x: fieldCentreX, y: fieldCentreY },
      lengthMetres: fieldWidthSimulation / unitsPerMetre,
      widthMetres: fieldHeightSimulation / unitsPerMetre,
      markings: {
        ...field.markings,
        centreCircleRadiusSimulation: scaleMetres(field.markings.centreCircleRadiusMetres, unitsPerMetre),
        centreSpotRadiusSimulation: scaleMetres(field.markings.centreSpotRadiusMetres, unitsPerMetre),
        penaltyAreaDepthSimulation: scaleMetres(field.markings.penaltyAreaDepthMetres, unitsPerMetre),
        penaltyAreaWidthSimulation: scaleMetres(field.markings.penaltyAreaWidthMetres, unitsPerMetre),
        goalAreaDepthSimulation: scaleMetres(field.markings.goalAreaDepthMetres, unitsPerMetre),
        goalAreaWidthSimulation: scaleMetres(field.markings.goalAreaWidthMetres, unitsPerMetre),
        penaltyMarkDistanceSimulation: scaleMetres(field.markings.penaltyMarkDistanceMetres, unitsPerMetre),
        lineWidthSimulation: scaleMetres(field.markings.lineWidthMetres, unitsPerMetre),
      },
    },
    goal: {
      ...goal,
      frameWidthMetres,
      mouthTop,
      mouthBottom,
      mouthWidthSimulation: goalMouthWidthSimulation,
      frameWidthSimulation: scaleMetres(frameWidthMetres, unitsPerMetre),
      depthSimulation: scaleMetres(goal.depthMetres, unitsPerMetre),
      postThicknessSimulation: goalPostThicknessSimulation,
      postRadiusMetres: goal.postThicknessMetres / 2,
      crossbarCentreHeightMetres: goal.crossbarHeightMetres + goal.postThicknessMetres / 2,
      scoringMaxBallHeightMetres: goal.crossbarHeightMetres - ball.radiusMetres * 2,
      scoringMouthTop: mouthTop + ballRadiusSimulation,
      scoringMouthBottom: mouthBottom - ballRadiusSimulation,
    },
    player: {
      ...player,
      representativeHeightWorldUnits: player.representativeHeightMetres * simulation.worldUnitsPerMetre,
      collisionRadiusSimulation: scaleMetres(player.collisionRadiusMetres, unitsPerMetre),
      goalkeeperCollisionRadiusSimulation: scaleMetres(player.goalkeeperCollisionRadiusMetres, unitsPerMetre),
    },
    ball: {
      ...ball,
      radiusSimulation: ballRadiusSimulation,
      radiusWorldUnits: ball.radiusMetres * simulation.worldUnitsPerMetre,
      diameterMetres: ball.radiusMetres * 2,
    },
  };

  return deepFreeze(profile);
}

export function assertSimulationWorldDimensions(
  width,
  height,
  profile = DEFAULT_SIMULATION_SCALE_PROFILE,
) {
  positive(width, "simulation world width");
  positive(height, "simulation world height");
  const expectedWidth = profile?.simulation?.worldWidth;
  const expectedHeight = profile?.simulation?.worldHeight;
  positive(expectedWidth, "scale profile simulation.worldWidth");
  positive(expectedHeight, "scale profile simulation.worldHeight");
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new RangeError(
      `simulation world dimensions must match scale profile ${profile.id}: ${expectedWidth} × ${expectedHeight}`,
    );
  }
  return profile;
}

export function representativeRigScale(measuredHeightWorldUnits, profile = DEFAULT_SIMULATION_SCALE_PROFILE) {
  positive(measuredHeightWorldUnits, "measured rig height");
  return profile.player.representativeHeightWorldUnits / measuredHeightWorldUnits;
}

export function simulationUnitsToMetres(value, profile = DEFAULT_SIMULATION_SCALE_PROFILE) {
  finite(value, "simulation value");
  return value / profile.simulation.unitsPerMetre;
}

export function metresToSimulationUnits(value, profile = DEFAULT_SIMULATION_SCALE_PROFILE) {
  finite(value, "metres value");
  return value * profile.simulation.unitsPerMetre;
}

export function simulationUnitsToWorldUnits(value, profile = DEFAULT_SIMULATION_SCALE_PROFILE) {
  finite(value, "simulation value");
  return value * profile.simulation.worldUnitsPerSimulationUnit;
}

export const DEFAULT_SIMULATION_SCALE_PROFILE = createSimulationScaleProfile();
