import { readFileSync } from "node:fs";

const content = readFileSync(new URL("../game.js", import.meta.url));
console.log("TON80_GAME_BASE64_BEGIN");
console.log(content.toString("base64"));
console.log("TON80_GAME_BASE64_END");
