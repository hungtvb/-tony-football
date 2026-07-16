export const FO4_CONTROLS = Object.freeze({
  sprint: "KeyE",
  shortPass: "KeyS",
  throughBall: "KeyW",
  shoot: "KeyD",
  loftPass: "KeyA",
  teammateRun: "KeyQ",
  finesse: "KeyZ",
  shield: "KeyC",
  tackle: "Space",
  camera: "KeyB"
});

export const FO4_DIRECTION_CODES = Object.freeze([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown"
]);

export const FO4_ATTACK_ACTION_CODES = Object.freeze([
  FO4_CONTROLS.shortPass,
  FO4_CONTROLS.throughBall,
  FO4_CONTROLS.shoot,
  FO4_CONTROLS.loftPass
]);

export function movementFromPressedCodes(pressedCodes) {
  let x = 0;
  let y = 0;
  if (pressedCodes.has("ArrowLeft")) x -= 1;
  if (pressedCodes.has("ArrowRight")) x += 1;
  if (pressedCodes.has("ArrowUp")) y -= 1;
  if (pressedCodes.has("ArrowDown")) y += 1;
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0) return Object.freeze({ x: 0, y: 0 });
  return Object.freeze({ x: x / magnitude, y: y / magnitude });
}

export function directionFromCode(code) {
  const directions = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }
  };
  const direction = directions[code];
  return direction ? Object.freeze({ ...direction }) : null;
}
