import assert from "node:assert/strict";
import test from "node:test";

import { GameEventType, createGameEvent } from "../../src/game/engine/GameEvents.js";
import { BROWSER_GAME_EVENT } from "../../src/game/presentation/BrowserGameEventBridge.js";
import { createBrowserAudioAdapter } from "../../src/game/presentation/BrowserAudioAdapter.js";
import { createBrowserPresentationFeedbackAdapter } from "../../src/game/presentation/BrowserPresentationFeedbackAdapter.js";

class DetailEvent extends Event {
  constructor(type, detail) {
    super(type);
    this.detail = detail;
  }
}

function publish(target, type, payload = {}, sequence = 0) {
  target.dispatchEvent(new DetailEvent(
    BROWSER_GAME_EVENT,
    createGameEvent(type, payload, { tick: 1, sequence }),
  ));
}

function createFakeAudioContext() {
  const tones = [];
  const context = {
    currentTime: 10,
    destination: {},
    closed: false,
    resumed: 0,
    resume() {
      this.resumed += 1;
      return Promise.resolve();
    },
    close() {
      this.closed = true;
    },
    createOscillator() {
      const tone = { type: "", frequency: { value: 0 }, starts: [], stops: [] };
      tones.push(tone);
      return {
        get type() {
          return tone.type;
        },
        set type(value) {
          tone.type = value;
        },
        frequency: tone.frequency,
        connect(node) {
          tone.connected = node;
          return node;
        },
        start(at) {
          tone.starts.push(at);
        },
        stop(at) {
          tone.stops.push(at);
        },
      };
    },
    createGain() {
      const gain = {
        values: [],
        ramps: [],
        setValueAtTime(value, at) {
          this.values.push([value, at]);
        },
        exponentialRampToValueAtTime(value, at) {
          this.ramps.push([value, at]);
        },
      };
      return {
        gain,
        connect() {
          return context.destination;
        },
      };
    },
  };
  return { context, tones };
}

test("presentation feedback delegates browser event audio while retaining particles", () => {
  const target = new EventTarget();
  const { context, tones } = createFakeAudioContext();
  const legacyAudio = [];
  const particles = [];
  let now = 1;
  const feedback = createBrowserPresentationFeedbackAdapter({
    target,
    createAudioContext: () => context,
    nowSeconds: () => now,
    onKick: () => legacyAudio.push("kick"),
    onGoal: () => legacyAudio.push("goal"),
    onWhistle: () => legacyAudio.push("whistle"),
    onParticles: (value) => particles.push(value),
  });

  publish(target, GameEventType.BALL_KICKED, { power: 0.8, x: 10, y: 20 });
  now += 2;
  publish(target, GameEventType.SCORE_CHANGED, { team: 0, x: 10, y: 20 }, 1);

  assert.deepEqual(legacyAudio, []);
  assert.equal(particles.length, 2);
  assert.equal(tones.length, 5);
  assert.equal(tones[0].type, "triangle");
  assert.equal(tones.slice(1).every((tone) => tone.type === "square"), true);
  assert.equal(feedback.unsubscribe(), true);
  assert.equal(feedback.unsubscribe(), false);
  assert.equal(context.closed, true);
});

test("headless targets retain legacy audio callbacks when Web Audio is unsupported", () => {
  const target = new EventTarget();
  const calls = [];
  const feedback = createBrowserPresentationFeedbackAdapter({
    target,
    onWhistle: (long) => calls.push(long),
  });

  publish(target, GameEventType.MATCH_STARTED);
  publish(target, GameEventType.MATCH_ENDED, {}, 1);

  assert.deepEqual(calls, [false, true]);
  feedback.unsubscribe();
});

test("browser audio adapter rejects duplicate ownership and releases it on teardown", () => {
  const target = new EventTarget();
  const first = createBrowserAudioAdapter({
    target,
    createAudioContext: () => null,
    nowSeconds: () => 1,
  });
  const second = createBrowserAudioAdapter({
    target,
    createAudioContext: () => null,
    nowSeconds: () => 1,
  });

  assert.equal(first.attach(), true);
  assert.throws(() => second.attach(), /already owned/);
  assert.equal(first.reset(), true);
  assert.equal(first.teardown(), true);
  assert.equal(second.attach(), true);
  second.teardown();
});

test("browser audio adapter honors the mute predicate without invoking Web Audio", () => {
  const target = new EventTarget();
  const { context, tones } = createFakeAudioContext();
  const audio = createBrowserAudioAdapter({
    target,
    createAudioContext: () => context,
    nowSeconds: () => 1,
    isEnabled: () => false,
  });

  audio.attach();
  publish(target, GameEventType.MATCH_STARTED);
  assert.equal(tones.length, 0);
  audio.teardown();
});
