import assert from "node:assert/strict";
import test from "node:test";

import { BrowserMatchRuntime } from "../../src/game/application/BrowserMatchRuntime.js";
import { GameCommandSource, GameCommandType, createGameCommand } from "../../src/game/engine/GameCommands.js";
import { GameEventType } from "../../src/game/engine/GameEvents.js";
import { MatchEngine } from "../../src/game/engine/MatchEngine.js";

const STEP = 1 / 60;

test("live browser runtime enters replay on score and exits before coherent kickoff", () => {
  const engine = new MatchEngine({ kickoffDelay: 0.25, goalDuration: 3.65 });
  const published = [];
  const runtime = new BrowserMatchRuntime({
    engine,
    publishEvent: (event) => published.push(event),
  });

  runtime.dispatch(createGameCommand(GameCommandType.START_MATCH, {}, {
    source: GameCommandSource.APPLICATION,
  }));
  runtime.step(STEP);
  published.length = 0;

  assert.equal(engine.recordGoal(0, { scorerId: "home-4" }), true);
  const scored = runtime.step(STEP);
  assert.deepEqual(
    scored.events.map((event) => event.type),
    [GameEventType.SCORE_CHANGED, GameEventType.REPLAY_STARTED]
  );
  assert.deepEqual(published.map((event) => event.type), [
    GameEventType.SCORE_CHANGED,
    GameEventType.REPLAY_STARTED,
  ]);

  const replayFrame = runtime.step(STEP);
  assert.equal(replayFrame.snapshot.match.replay.active, true);
  assert.deepEqual(replayFrame.snapshot.match.score, [1, 0]);
  assert.ok(replayFrame.snapshot.match.goalSequence);

  let replayEnded = false;
  for (let index = 0; index < 240 && !replayEnded; index += 1) {
    const result = runtime.step(STEP);
    replayEnded = result.events.some((event) => event.type === GameEventType.REPLAY_ENDED);
  }
  assert.equal(replayEnded, true);
  assert.equal(runtime.snapshot.match.replay.active, false);

  for (let index = 0; index < 90 && runtime.snapshot.match.goalSequence; index += 1) {
    runtime.step(STEP);
  }
  assert.equal(runtime.snapshot.match.goalSequence, null);
  assert.deepEqual(runtime.snapshot.match.score, [1, 0]);
  assert.equal(runtime.snapshot.ball.ownerId, null);
  assert.ok(runtime.snapshot.match.kickoffTimer > 0);
});
