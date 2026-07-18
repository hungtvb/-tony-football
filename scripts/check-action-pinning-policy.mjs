import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/i;
const ACTION_MANIFEST_NAMES = ["action.yml", "action.yaml"];
const FULL_SHA = /^[0-9a-f]{40}$/i;
const DOCKER_DIGEST = /^docker:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/i;
const VERSION_COMMENT = /#\s*v?\d+\.\d+\.\d+(?:\s|$)/i;

export const ACTION_PIN_RULE_ID = "third-party-action-not-full-sha";
export const ACTION_VERSION_RULE_ID = "pinned-action-version-comment-missing";
export const CHECKOUT_CREDENTIAL_RULE_ID = "checkout-persist-credentials-not-false";
export const LOCAL_ACTION_SCAN_RULE_ID = "local-action-requires-repository-scan";
export const LOCAL_ACTION_PATH_RULE_ID = "local-action-path-invalid";
export const LOCAL_ACTION_MANIFEST_RULE_ID = "local-action-manifest-invalid";
export const LOCAL_ACTION_CYCLE_RULE_ID = "local-action-cycle";
export const LOCAL_DOCKER_ACTION_RULE_ID = "local-docker-action-unsupported";

function normalizeRepositoryPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function indentation(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function mappingKeyIndent(line) {
  return indentation(line) + (/^\s*-\s+/.test(line) ? 2 : 0);
}

function stripInlineComment(line) {
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (doubleQuoted && character === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (!escaped && character === "'" && !doubleQuoted) singleQuoted = !singleQuoted;
    if (!escaped && character === '"' && !singleQuoted) doubleQuoted = !doubleQuoted;
    if (!singleQuoted && !doubleQuoted && character === "#" && (index === 0 || /\s/.test(line[index - 1]))) return line.slice(0, index);
    escaped = false;
  }
  return line;
}

function finding(sourcePath, line, ruleId, reason, action) {
  const normalizedPath = normalizeRepositoryPath(sourcePath);
  return {
    path: normalizedPath,
    line,
    jobId: normalizedPath.startsWith(`${WORKFLOW_DIRECTORY}/`) ? "<workflow>" : "<local-action>",
    ruleId,
    code: ruleId,
    reason,
    message: reason,
    action,
  };
}

function stepBounds(lines, usesIndex) {
  const activeUses = stripInlineComment(lines[usesIndex]);
  const usesIndent = indentation(activeUses);
  const inlineUses = /^\s*-\s*uses\s*:/.test(activeUses);
  let start = usesIndex;

  if (!inlineUses) {
    for (let index = usesIndex - 1; index >= 0; index -= 1) {
      const active = stripInlineComment(lines[index]);
      if (/^\s*-\s+/.test(active) && indentation(active) < usesIndent) {
        start = index;
        break;
      }
    }
  }

  const stepIndent = indentation(stripInlineComment(lines[start]));
  const keyIndent = mappingKeyIndent(activeUses);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const active = stripInlineComment(lines[index]);
    if (/^\s*-\s+/.test(active) && indentation(active) === stepIndent) {
      end = index;
      break;
    }
    if (active.trim() && indentation(active) < stepIndent) {
      end = index;
      break;
    }
  }
  return { start, end, keyIndent };
}

function checkoutDisablesCredentials(lines, start, end, keyIndent) {
  let withBlocks = 0;
  const declarations = [];

  for (let index = start; index < end; index += 1) {
    const active = stripInlineComment(lines[index]);
    if (!/^\s*(?:-\s*)?with\s*:\s*$/.test(active) || mappingKeyIndent(active) !== keyIndent) continue;
    withBlocks += 1;

    const withIndent = mappingKeyIndent(active);
    let inputIndent = null;
    for (let child = index + 1; child < end; child += 1) {
      const input = stripInlineComment(lines[child]);
      if (!input.trim()) continue;
      const currentIndent = indentation(input);
      if (currentIndent <= withIndent) break;
      if (inputIndent === null) inputIndent = currentIndent;
      if (currentIndent !== inputIndent) continue;
      const match = input.match(/^\s*persist-credentials\s*:\s*["']?([^\s"']+)["']?\s*$/i);
      if (match) declarations.push(match[1].toLowerCase());
    }
  }

  return withBlocks === 1 && declarations.length === 1 && declarations[0] === "false";
}

function inspectActionSource({ sourcePath, source, deferLocalActions }) {
  const violations = [];
  const localReferences = [];
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const active = stripInlineComment(lines[index]);
    const uses = active.match(/^\s*(?:-\s*)?uses\s*:\s*(.*?)\s*$/i);
    if (!uses) continue;

    const simpleValue = uses[1].match(/^["']?([^\s"']+)["']?$/);
    if (!simpleValue) {
      violations.push(finding(sourcePath, index + 1, ACTION_PIN_RULE_ID, "action uses values must be a simple immutable scalar reference", uses[1] || "<multiline>"));
      continue;
    }

    const action = simpleValue[1];
    if (action.startsWith("./")) {
      localReferences.push({ action, line: index + 1 });
      if (!deferLocalActions) {
        violations.push(finding(sourcePath, index + 1, LOCAL_ACTION_SCAN_RULE_ID, "local actions require repository-level dependency closure", action));
      }
      continue;
    }

    if (action.startsWith("docker://")) {
      if (!DOCKER_DIGEST.test(action)) {
        violations.push(finding(sourcePath, index + 1, ACTION_PIN_RULE_ID, "container actions must use an immutable sha256 digest", action));
      } else if (!VERSION_COMMENT.test(lines[index])) {
        violations.push(finding(sourcePath, index + 1, ACTION_VERSION_RULE_ID, "a pinned container action must include a readable semantic-version comment", action));
      }
      continue;
    }

    const separator = action.lastIndexOf("@");
    const ref = separator === -1 ? "" : action.slice(separator + 1);
    if (!FULL_SHA.test(ref)) {
      violations.push(finding(sourcePath, index + 1, ACTION_PIN_RULE_ID, "third-party actions must use a full 40-character commit SHA", action));
    } else if (!VERSION_COMMENT.test(lines[index])) {
      violations.push(finding(sourcePath, index + 1, ACTION_VERSION_RULE_ID, "a full-SHA action pin must include a readable semantic-version comment", action));
    }

    if (!/^actions\/checkout@/i.test(action)) continue;
    const { start, end, keyIndent } = stepBounds(lines, index);
    if (!checkoutDisablesCredentials(lines, start, end, keyIndent)) {
      violations.push(finding(sourcePath, index + 1, CHECKOUT_CREDENTIAL_RULE_ID, "checkout must set persist-credentials: false", action));
    }
  }

  return { violations, localReferences };
}

export function inspectActionPinningPolicy({ workflowPath, source }) {
  return inspectActionSource({ sourcePath: workflowPath, source, deferLocalActions: false }).violations;
}

async function listWorkflowFiles(rootDir) {
  const workflowRoot = path.join(rootDir, WORKFLOW_DIRECTORY);
  const workflowPaths = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile() && WORKFLOW_EXTENSION.test(entry.name)) workflowPaths.push(normalizeRepositoryPath(path.relative(rootDir, absolutePath)));
    }
  }

  await visit(workflowRoot);
  return workflowPaths.sort();
}

function isInsideRoot(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function localActionRuntime(source) {
  const matches = [];
  for (const line of source.split(/\r?\n/)) {
    const active = stripInlineComment(line);
    const match = active.match(/^\s*using\s*:\s*["']?([^\s"']+)["']?\s*$/i);
    if (match) matches.push(match[1].toLowerCase());
  }
  return matches;
}

async function resolveLocalActionManifest({ rootDir, realRoot, sourcePath, line, reference }) {
  if (reference.includes("\\")) {
    return { violation: finding(sourcePath, line, LOCAL_ACTION_PATH_RULE_ID, "local action paths must use repository-relative forward slashes", reference) };
  }

  const relativeReference = reference.slice(2);
  const segments = relativeReference.split("/");
  if (!relativeReference || segments.some((segment) => segment === ".." || segment === "")) {
    return { violation: finding(sourcePath, line, LOCAL_ACTION_PATH_RULE_ID, "local action paths may not be empty, escape, or contain ambiguous segments", reference) };
  }

  const absoluteDirectory = path.resolve(rootDir, relativeReference);
  if (!isInsideRoot(rootDir, absoluteDirectory)) {
    return { violation: finding(sourcePath, line, LOCAL_ACTION_PATH_RULE_ID, "local action path resolves outside the repository", reference) };
  }

  let realDirectory;
  try {
    realDirectory = await realpath(absoluteDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { violation: finding(sourcePath, line, LOCAL_ACTION_MANIFEST_RULE_ID, "local action directory or manifest does not exist", reference) };
    }
    throw error;
  }

  if (!isInsideRoot(realRoot, realDirectory)) {
    return { violation: finding(sourcePath, line, LOCAL_ACTION_PATH_RULE_ID, "local action path escapes the repository through a symbolic link", reference) };
  }

  const candidates = [];
  for (const manifestName of ACTION_MANIFEST_NAMES) {
    const manifestPath = path.join(realDirectory, manifestName);
    try {
      const realManifestPath = await realpath(manifestPath);
      if (!isInsideRoot(realRoot, realManifestPath)) {
        return { violation: finding(sourcePath, line, LOCAL_ACTION_PATH_RULE_ID, "local action manifest escapes the repository through a symbolic link", reference) };
      }
      candidates.push({
        manifestPath: normalizeRepositoryPath(path.relative(realRoot, realManifestPath)),
        source: await readFile(realManifestPath, "utf8"),
      });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  if (candidates.length !== 1) {
    const reason = candidates.length === 0
      ? "local action must contain exactly one action.yml or action.yaml manifest"
      : "local action may not contain both action.yml and action.yaml manifests";
    return { violation: finding(sourcePath, line, LOCAL_ACTION_MANIFEST_RULE_ID, reason, reference) };
  }

  return candidates[0];
}

function dedupeFindings(findings) {
  const unique = new Map();
  for (const item of findings) {
    const key = [item.path, item.line, item.code, item.action].join("\u0000");
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

export async function scanActionPinningPolicy({ rootDir = process.cwd() } = {}) {
  const workflowPaths = await listWorkflowFiles(rootDir);
  const realRoot = await realpath(rootDir);
  const violations = [];
  const visitedLocalActions = new Set();

  async function visitLocalAction(reference, sourcePath, line, stack) {
    const resolution = await resolveLocalActionManifest({ rootDir, realRoot, sourcePath, line, reference });
    if (resolution.violation) {
      violations.push(resolution.violation);
      return;
    }

    const { manifestPath, source } = resolution;
    if (stack.includes(manifestPath)) {
      violations.push(finding(sourcePath, line, LOCAL_ACTION_CYCLE_RULE_ID, `local action dependency cycle reaches ${manifestPath}`, reference));
      return;
    }
    if (visitedLocalActions.has(manifestPath)) return;

    const runtimes = localActionRuntime(source);
    if (runtimes.length !== 1) {
      violations.push(finding(manifestPath, 1, LOCAL_ACTION_MANIFEST_RULE_ID, "local action manifest must declare exactly one simple runs.using value", reference));
      visitedLocalActions.add(manifestPath);
      return;
    }
    if (runtimes[0] === "docker") {
      violations.push(finding(manifestPath, 1, LOCAL_DOCKER_ACTION_RULE_ID, "local Docker actions are unsupported because Dockerfile dependency pins are outside this scanner", reference));
      visitedLocalActions.add(manifestPath);
      return;
    }
    if (runtimes[0] !== "composite" && !/^node\d+$/.test(runtimes[0])) {
      violations.push(finding(manifestPath, 1, LOCAL_ACTION_MANIFEST_RULE_ID, `unsupported local action runtime: ${runtimes[0]}`, reference));
      visitedLocalActions.add(manifestPath);
      return;
    }

    const inspected = inspectActionSource({ sourcePath: manifestPath, source, deferLocalActions: true });
    violations.push(...inspected.violations);
    const nextStack = [...stack, manifestPath];
    for (const localReference of inspected.localReferences) {
      await visitLocalAction(localReference.action, manifestPath, localReference.line, nextStack);
    }
    visitedLocalActions.add(manifestPath);
  }

  for (const workflowPath of workflowPaths) {
    const source = await readFile(path.join(rootDir, workflowPath), "utf8");
    const inspected = inspectActionSource({ sourcePath: workflowPath, source, deferLocalActions: true });
    violations.push(...inspected.violations);
    for (const localReference of inspected.localReferences) {
      await visitLocalAction(localReference.action, workflowPath, localReference.line, []);
    }
  }

  return {
    workflowCount: workflowPaths.length,
    localActionCount: visitedLocalActions.size,
    violations: dedupeFindings(violations),
  };
}

async function main() {
  const result = await scanActionPinningPolicy();
  if (result.violations.length > 0) {
    console.error("Workflow action pinning policy violations:");
    for (const item of result.violations) console.error(`- ${item.path} line=${item.line} [${item.ruleId}] ${item.reason}: ${item.action}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Workflow action pinning policy passed: ${result.workflowCount} workflow(s), ${result.localActionCount} local action(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
