import test from "node:test";
import assert from "node:assert/strict";
import { createAudioFeedbackController } from "../../src/game/presentation/AudioFeedbackController.js";

test("audio cooldown blocks repeated events until the window expires", () => {
  const audio = createAudioFeedbackController({ cooldowns: { kick: 0.1 } });
  assert.equal(audio.canPlay("kick", 1), true);
  assert.equal(audio.canPlay("kick", 1.05), false);
  assert.equal(audio.canPlay("kick", 1.11), true);
});

test("different audio channels do not block each other", () => {
  const audio = createAudioFeedbackController();
  assert.equal(audio.canPlay("kick", 2), true);
  assert.equal(audio.canPlay("whistle", 2), true);
});

test("reset clears cooldown history", () => {
  const audio = createAudioFeedbackController({ cooldowns: { goal: 5 } });
  assert.equal(audio.canPlay("goal", 3), true);
  assert.equal(audio.canPlay("goal", 4), false);
  audio.reset();
  assert.equal(audio.canPlay("goal", 4), true);
});

test("kick profile scales while staying bounded", () => {
  const audio = createAudioFeedbackController();
  const soft = audio.kickProfile(-1);
  const hard = audio.kickProfile(2);
  assert.ok(hard.frequency > soft.frequency);
  assert.ok(hard.duration > soft.duration);
  assert.ok(hard.volume > soft.volume);
});

test("tackle profile scales while staying bounded", () => {
  const audio = createAudioFeedbackController();
  const soft = audio.tackleProfile(0);
  const hard = audio.tackleProfile(1);
  assert.ok(hard.frequency > soft.frequency);
  assert.ok(hard.volume > soft.volume);
});
