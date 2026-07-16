import assert from "node:assert/strict";
import test from "node:test";

import { GameCommandType } from "../../src/game/engine/GameCommands.js";
import { GameEventType, createGameEvent } from "../../src/game/engine/GameEvents.js";
import {
  createCompatibilityKickEventPayload,
  createDeferredCompatibilityKickPublisher
} from "../../src/game/presentation/CompatibilityKickEventPayload.js";

test("compatibility producer emits the canonical engine kick schema", () => {
  const compatibilityPayload = createCompatibilityKickEventPayload({
    commandType: GameCommandType.SHOOT,
    playerId: "home-4",
    targetId: "away-0",
    power: 0.8,
    speed: 920,
    style: "power",
    aimY: 330,
    position: { x: 700, y: 320 },
    velocity: { x: 920, y: 0, z: 1.8 },
    presentation: { audioPower: 0.9 }
  });
  const compatibilityEvent = createGameEvent(GameEventType.BALL_KICKED, compatibilityPayload);
  const engineEvent = createGameEvent(GameEventType.BALL_KICKED, {
    type: GameCommandType.SHOOT,
    playerId: "home-4",
    ballId: "match-ball",
    targetId: "away-0",
    power: 0.8,
    speed: 920,
    style: "power",
    aimY: 330,
    velocity: { x: 920, y: 0, z: 1.8 }
  });

  for (const field of ["type", "playerId", "ballId", "targetId", "power", "speed", "style", "aimY"]) {
    assert.equal(compatibilityEvent.payload[field], engineEvent.payload[field]);
  }
  assert.deepEqual(compatibilityEvent.payload.velocity, engineEvent.payload.velocity);
  assert.equal(compatibilityEvent.payload.kind, undefined);
  assert.equal(compatibilityEvent.payload.power >= 0 && compatibilityEvent.payload.power <= 1, true);
  assert.equal(compatibilityEvent.payload.speed > 1, true);
});

test("engine event creation freezes payloads without compatibility normalization", () => {
  const event = createGameEvent(GameEventType.BALL_KICKED, {
    playerId: "home-4",
    power: 920
  });

  assert.equal(event.payload.power, 920);
  assert.equal(event.payload.speed, undefined);
  assert.equal(event.payload.style, undefined);
});


test("deferred compatibility producer captures action-specific final ball velocity", () => {
  const cases = [
    { style: "chip", finalVz: 14.1 },
    { style: "finesse", finalVz: 2.6 },
    { style: "chipped-through", finalVz: 10.7 },
    { style: "loft", finalVz: 11.9 }
  ];

  for (const scenario of cases) {
    const ball = { x: 700, y: 320, vx: 840, vy: 20, vz: 1.8 };
    const published = [];
    const publishKickEvent = createDeferredCompatibilityKickPublisher({
      publish: (payload) => published.push(payload),
      getBallState: () => ball,
      commandType: scenario.style === "chip" || scenario.style === "finesse"
        ? GameCommandType.SHOOT
        : scenario.style === "loft"
          ? GameCommandType.LOFTED_PASS
          : GameCommandType.THROUGH_BALL,
      playerId: "home-4",
      targetId: "away-0",
      power: 0.8,
      speed: 840,
      style: scenario.style
    });

    ball.vz = scenario.finalVz;
    const payload = publishKickEvent();

    assert.equal(payload.velocity.z, scenario.finalVz);
    assert.equal(published[0].velocity.z, scenario.finalVz);
  }
});
