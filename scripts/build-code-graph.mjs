import { writeGraphOutputs } from "./code-graph-lib.mjs";

const rootDir = process.cwd();
const outputs = await writeGraphOutputs({ rootDir });
console.log(`Architecture graph generated: ${Object.keys(outputs).join(", ")}`);