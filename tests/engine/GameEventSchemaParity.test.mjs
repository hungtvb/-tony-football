import assert from "node:assert/strict";
import test from "node:test";

import { GameEventType, createGameEvent } from "../../src/game/engine/GameEvents.js";

test("compatibility and engine kick events expose canonical power and speed units", () => {
  const compatibilityEvent = createGameEvent(GameEventType.BALL_KICKED, {
    playerId: "home-4",
    kind: "shot",
    power: 920,
    audioPower: 0.9
  });
  const engineEvent = createGameEvent(GameEventType.BALL_KICKED, {
    playerId: "home-4",
    type: "ball:shoot",
    power: 0.7,
    speed: 921,
    style: "power",
    velocity: { x: 921, y: 0, z: 1.8 }
  });

  assert.deepEqual(
    [compatibilityEvent, engineEvent].map((event) => ({
      powerIsNormalized: event.payload.power >= 0 && event.payload.power <= 1,
      speedUsesWorldUnits: event.payload.speed > 1
    })),
    [
      { powerIsNormalized: true, speedUsesWorldUnits: true },
      { powerIsNormalized: true, speedUsesWorldUnits: true }
    ]
  );
  assert.equal(compatibilityEvent.payload.power, 0.8);
  assert.equal(compatibilityEvent.payload.speed, 920);
  assert.equal(compatibilityEvent.payload.style, "shot");
  assert.equal(engineEvent.payload.power, 0.7);
  assert.equal(engineEvent.payload.speed, 921);
});
