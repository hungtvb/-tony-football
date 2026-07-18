import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/i;
const FULL_SHA = /^[0-9a-f]{40}$/i;
const DOCKER_DIGEST = /^docker:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/i;
const VERSION_COMMENT = /#\s*v?\d+\.\d+\.\d+(?:\s|$)/i;

export const ACTION_PIN_RULE_ID = "third-party-action-not-full-sha";
export const ACTION_VERSION_RULE_ID = "pinned-action-version-comment-missing";
export const CHECKOUT_CREDENTIAL_RULE_ID = "checkout-persist-credentials-not-false";

function normalizeRepositoryPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function indentation(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
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

function finding(workflowPath, line, ruleId, reason, action) {
  return { path: normalizeRepositoryPath(workflowPath), line, jobId: "<workflow>", ruleId, code: ruleId, reason, message: reason, action };
}

function stepBounds(lines, usesIndex) {
  const usesIndent = indentation(lines[usesIndex]);
  let start = usesIndex;
  if (!/^\s*-\s*uses\s*:/.test(lines[usesIndex])) {
    for (let index = usesIndex - 1; index >= 0; index -= 1) {
      if (/^\s*-\s+/.test(lines[index]) && indentation(lines[index]) < usesIndent) { start = index; break; }
    }
  }
  const stepIndent = indentation(lines[start]);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*-\s+/.test(lines[index]) && indentation(lines[index]) === stepIndent) { end = index; break; }
    if (lines[index].trim() && indentation(lines[index]) < stepIndent) { end = index; break; }
  }
  return { start, end };
}

function checkoutDisablesCredentials(lines, usesIndex, end) {
  const usesIndent = indentation(lines[usesIndex]);
  for (let index = usesIndex + 1; index < end; index += 1) {
    const active = stripInlineComment(lines[index]);
    if (!/^\s*with\s*:\s*$/.test(active) || indentation(active) !== usesIndent) continue;
    const withIndent = indentation(active);
    for (let child = index + 1; child < end; child += 1) {
      const input = stripInlineComment(lines[child]);
      if (!input.trim()) continue;
      if (indentation(input) <= withIndent) break;
      if (/^\s*persist-credentials\s*:\s*["']?false["']?\s*$/.test(input)) return true;
    }
    return false;
  }
  return false;
}

export function inspectActionPinningPolicy({ workflowPath, source }) {
  const findings = [];
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const active = stripInlineComment(lines[index]);
    const match = active.match(/^\s*(?:-\s*)?uses\s*:\s*["']?([^\s"']+)["']?\s*$/i);
    if (!match) continue;
    const action = match[1];
    if (action.startsWith("./")) continue;
    if (action.startsWith("docker://")) {
      if (!DOCKER_DIGEST.test(action)) {
        findings.push(finding(workflowPath, index + 1, ACTION_PIN_RULE_ID, "container actions must use an immutable sha256 digest", action));
      } else if (!VERSION_COMMENT.test(lines[index])) {
        findings.push(finding(workflowPath, index + 1, ACTION_VERSION_RULE_ID, "a pinned container action must include a readable semantic-version comment", action));
      }
      continue;
    }
    const separator = action.lastIndexOf("@");
    const ref = separator === -1 ? "" : action.slice(separator + 1);
    if (!FULL_SHA.test(ref)) {
      findings.push(finding(workflowPath, index + 1, ACTION_PIN_RULE_ID, "third-party actions must use a full 40-character commit SHA", action));
    } else if (!VERSION_COMMENT.test(lines[index])) {
      findings.push(finding(workflowPath, index + 1, ACTION_VERSION_RULE_ID, "a full-SHA action pin must include a readable semantic-version comment", action));
    }

    if (!/^actions\/checkout@/i.test(action)) continue;
    const { end } = stepBounds(lines, index);
    if (!checkoutDisablesCredentials(lines, index, end)) {
      findings.push(finding(workflowPath, index + 1, CHECKOUT_CREDENTIAL_RULE_ID, "checkout must set persist-credentials: false", action));
    }
  }
  return findings;
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

export async function scanActionPinningPolicy({ rootDir = process.cwd() } = {}) {
  const workflowPaths = await listWorkflowFiles(rootDir);
  const violations = [];
  for (const workflowPath of workflowPaths) {
    const source = await readFile(path.join(rootDir, workflowPath), "utf8");
    violations.push(...inspectActionPinningPolicy({ workflowPath, source }));
  }
  return { workflowCount: workflowPaths.length, violations };
}

async function main() {
  const result = await scanActionPinningPolicy();
  if (result.violations.length > 0) {
    console.error("Workflow action pinning policy violations:");
    for (const item of result.violations) console.error(`- ${item.path} line=${item.line} [${item.ruleId}] ${item.reason}: ${item.action}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Workflow action pinning policy passed: ${result.workflowCount} workflow(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
