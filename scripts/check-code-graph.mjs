import { checkGraphOutputs } from "./code-graph-lib.mjs";

const { stale } = await checkGraphOutputs({ rootDir: process.cwd() });
if (stale.length > 0) {
  console.error(`Architecture graph outputs are stale or missing: ${stale.join(", ")}`);
  console.error("Run npm run graph:build and commit the regenerated files.");
  process.exitCode = 1;
} else {
  console.log("Architecture graph is valid and current.");
}