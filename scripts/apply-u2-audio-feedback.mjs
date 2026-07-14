import { readFile, writeFile } from "node:fs/promises";

const path = "game.js";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { createBallTrail3D } from "./src/game/presentation/BallTrail3D.js";',
  'import { createBallTrail3D } from "./src/game/presentation/BallTrail3D.js";\nimport { createAudioFeedbackController } from "./src/game/presentation/AudioFeedbackController.js";',
  "audio controller import",
);

replaceOnce(
  '  const gameFeel = createGameFeelController({ lowPowerDevice, reducedMotion });',
  '  const gameFeel = createGameFeelController({ lowPowerDevice, reducedMotion });\n  const audioFeedback = createAudioFeedbackController();',
  "audio controller initialization",
);

replaceOnce(
  '  function kickSound(power) { tone(110 + power * 90, .08, "triangle", .035 + power * .025); }\n  function whistle(long = false) { tone(1450, long ? .5 : .25, "sine", .03); tone(1750, long ? .42 : .18, "sine", .02, .08); }\n  function goalSound() { [392,523,659,784].forEach((note,index) => tone(note,.42,"square",.025,index*.09)); }',
  '  function audioNow() { return audioContext?.currentTime ?? performance.now() / 1000; }\n  function kickSound(power) { if(!audioFeedback.canPlay("kick",audioNow()))return;const profile=audioFeedback.kickProfile(power);tone(profile.frequency,profile.duration,"triangle",profile.volume); }\n  function whistle(long = false) { if(!audioFeedback.canPlay("whistle",audioNow()))return;tone(1450,long?.5:.25,"sine",.03);tone(1750,long?.42:.18,"sine",.02,.08); }\n  function goalSound() { if(!audioFeedback.canPlay("goal",audioNow()))return;[392,523,659,784].forEach((note,index)=>tone(note,.42,"square",.025,index*.09)); }',
  "audio cooldown integration",
);

await writeFile(path, source);
console.log("Applied U2 audio feedback integration");
