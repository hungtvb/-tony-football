import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_ALLOWLIST_PATH = ".github/workflow-policy-allowlist.json";
const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/i;

const RULES = {
  contentsWrite: ["unallowlisted-contents-write", "contents: write requires an exact path + job policy exception"],
  writeAll: ["write-all", "permissions: write-all is prohibited"],
  push: ["direct-git-push", "workflows may not push repository changes directly"],
  commit: ["workflow-self-commit", "workflows may not create repository commits"],
  autoCommit: ["workflow-auto-commit-action", "auto-commit actions are prohibited"],
  applyPatch: ["source-patch-application", "workflows may not apply source patches"],
  encodedPatch: ["encoded-patch-transport", "encoded source patch transport is prohibited"],
  apiMutation: ["github-api-repository-mutation", "GitHub API file/tree/commit/ref mutation is prohibited"],
  selfDelete: ["workflow-self-delete", "workflows may not delete workflow files or transport scripts"],
  rewrite: ["rewrite-and-publish", "workflow rewrites repository content and attempts to publish it"],
};

const DIRECT_PUSH = /(?:^|[\s;&|])git\s+(?:-[^\s]+\s+)*push(?:\s|$)/im;
const SELF_COMMIT = /(?:^|[\s;&|])git\s+(?:-[^\s]+\s+)*commit(?:\s|$)/im;
const AUTO_COMMIT_ACTION = /(?:git-auto-commit-action|add-and-commit|auto-commit)@/i;
const APPLY_PATCH = /(?:^|[\s;&|])(?:git\s+apply|patch\s+-p\d*|apply_patch)(?:\s|$)/im;
const ENCODED_PATCH_MARKER = /\b(?:PATCH_GZIP_BASE64|PATCH_BASE64|BASE64_PATCH|ENCODED_PATCH|PATCH_PAYLOAD_BASE64)\b/im;
const BASE64_DECODE = /\bbase64\s+(?:--decode|-d)\b/im;
const API_MUTATION = /(?:createOrUpdateFileContents|deleteFile|createBlob|createTree|createCommit|updateRef|deleteRef|POST\s+\/repos\/[^\s]+\/git\/(?:blobs|trees|commits|refs)|PUT\s+\/repos\/[^\s]+\/contents\/|DELETE\s+\/repos\/[^\s]+\/contents\/)/i;
const SELF_DELETE = /(?:git\s+rm|\brm\s+(?:-[^\s]+\s+)*)[^\n]*(?:\.github\/workflows\/|scripts\/[^\s]*(?:patch|transport)|\$\{\{\s*github\.workflow_ref\s*\}\})/im;
const REWRITE_COMMAND = /\b(?:sed|perl|python|node|tee|cat)\b/im;
const REPOSITORY_PATH = /(?:src\/|tests\/|docs\/|scripts\/|game\.js|package\.json|\.github\/workflows\/)/im;

function normalizeRepositoryPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function indentation(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function uncommentedLines(source) {
  return source.split(/\r?\n/).map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => !/^\s*#/.test(line));
}

function scalar(value) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function collectBlock(lines, start, parentIndent) {
  const result = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].line.trim() && indentation(lines[index].line) <= parentIndent) break;
    result.push(lines[index]);
  }
  return result;
}

export function extractWorkflowTriggers(source) {
  const lines = uncommentedLines(source);
  const triggers = new Set();
  const onIndex = lines.findIndex(({ line }) => /^\s*["']?on["']?\s*:/.test(line));
  if (onIndex === -1) return triggers;
  const onLine = lines[onIndex].line;
  const onIndent = indentation(onLine);
  const inline = onLine.replace(/^\s*["']?on["']?\s*:\s*/, "").trim();
  if (inline) {
    const keys = [...inline.matchAll(/([a-z][a-z0-9_-]*)\s*:/gi)].map((match) => match[1]);
    for (const value of (keys.length ? keys : inline.replace(/[\[\]{},]/g, " ").split(/\s+/))) {
      if (/^[a-z][a-z0-9_-]*$/i.test(value) && !/^(?:true|false|null)$/i.test(value)) triggers.add(value);
    }
  }
  let triggerIndent = null;
  for (const { line } of collectBlock(lines, onIndex, onIndent)) {
    const match = line.match(/^\s*["']?([a-z][a-z0-9_-]*)["']?\s*:/i);
    if (!match) continue;
    const currentIndent = indentation(line);
    if (triggerIndent === null) triggerIndent = currentIndent;
    if (currentIndent === triggerIndent) triggers.add(match[1]);
  }
  return triggers;
}

function parsePermissions(lines) {
  const scopes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].line.match(/^(\s*)permissions\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const values = new Map();
    if (match[2]) values.set("*", scalar(match[2]));
    for (const child of collectBlock(lines, index, match[1].length)) {
      const permission = child.line.match(/^\s*([\w-]+)\s*:\s*([^#]+?)\s*$/);
      if (permission) values.set(permission[1], scalar(permission[2]));
    }
    scopes.push({ values, line: lines[index].index });
  }
  return scopes;
}

function parseExecutable(lines) {
  const values = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].line.match(/^\s*(?:-\s*)?(run|uses|script)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (/^[|>][-+]?\s*$/.test(value)) {
      value = collectBlock(lines, index, indentation(lines[index].line)).map(({ line }) => line.trim()).join("\n");
    }
    values.push({ kind: match[1], value: scalar(value), line: lines[index].index });
  }
  return values;
}

function extractJobs(source) {
  const lines = uncommentedLines(source);
  const jobsIndex = lines.findIndex(({ line }) => /^\s*jobs\s*:/.test(line));
  if (jobsIndex === -1) return { workflowLines: lines, jobs: [] };
  const jobsIndent = indentation(lines[jobsIndex].line);
  const jobsBlock = collectBlock(lines, jobsIndex, jobsIndent);
  let jobIndent = null;
  const starts = [];
  for (let index = 0; index < jobsBlock.length; index += 1) {
    const match = jobsBlock[index].line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*$/);
    if (!match) continue;
    const currentIndent = indentation(jobsBlock[index].line);
    if (jobIndent === null) jobIndent = currentIndent;
    if (currentIndent === jobIndent) starts.push({ index, id: match[1] });
  }
  const jobs = starts.map((start, i) => ({
    id: start.id,
    lines: jobsBlock.slice(start.index + 1, starts[i + 1]?.index ?? jobsBlock.length),
  }));
  return { workflowLines: lines.slice(0, jobsIndex), jobs };
}

function validateException(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError(`workflow policy exception ${index} must be an object`);
  const workflowPath = normalizeRepositoryPath(entry.path ?? "");
  if (!workflowPath.startsWith(`${WORKFLOW_DIRECTORY}/`) || !WORKFLOW_EXTENSION.test(workflowPath)) {
    throw new TypeError(`workflow policy exception ${index} requires an exact .github/workflows/*.yml or .yaml path`);
  }
  for (const field of ["job", "owner", "reason", "reviewIssue"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) throw new TypeError(`workflow policy exception ${index} requires ${field}`);
  }
  if (!Array.isArray(entry.allowedTriggers) || entry.allowedTriggers.length === 0) throw new TypeError(`workflow policy exception ${index} requires allowedTriggers`);
  if (entry.allowedTriggers.some((trigger) => typeof trigger !== "string" || !/^[a-z][a-z0-9_-]*$/i.test(trigger))) {
    throw new TypeError(`workflow policy exception ${index} has invalid triggers`);
  }
  if (!Array.isArray(entry.permissions) || entry.permissions.length !== 1 || entry.permissions[0] !== "contents:write") {
    throw new TypeError(`workflow policy exception ${index} must allow only contents:write`);
  }
  return { ...entry, path: workflowPath, allowedTriggers: new Set(entry.allowedTriggers), key: `${workflowPath}#${entry.job}` };
}

export function parseWorkflowPolicyAllowlist(source) {
  const parsed = JSON.parse(source);
  if (parsed?.version !== 1 || !Array.isArray(parsed.exceptions)) throw new TypeError("workflow policy allowlist requires version 1 and exceptions array");
  const exceptions = parsed.exceptions.map(validateException);
  const keys = new Set();
  for (const entry of exceptions) {
    if (keys.has(entry.key)) throw new TypeError(`duplicate workflow policy exception: ${entry.key}`);
    keys.add(entry.key);
  }
  return new Map(exceptions.map((entry) => [entry.key, entry]));
}

export function inspectWorkflow({ workflowPath, source, allowlist = new Map() }) {
  const normalizedPath = normalizeRepositoryPath(workflowPath);
  const triggers = extractWorkflowTriggers(source);
  const { workflowLines, jobs } = extractJobs(source);
  const violations = [];
  const used = new Set();
  const add = (rule, jobId, line = null) => {
    const [ruleId, reason] = rule;
    violations.push({ path: normalizedPath, jobId, ruleId, code: ruleId, reason, message: reason, line });
  };
  const inspectScope = (jobId, lines) => {
    for (const permission of parsePermissions(lines)) {
      const writeAll = permission.values.get("*") === "write-all";
      const contentsWrite = permission.values.get("contents") === "write";
      if (writeAll) add(RULES.writeAll, jobId, permission.line);
      if (contentsWrite || writeAll) {
        const key = `${normalizedPath}#${jobId}`;
        const exception = allowlist.get(key);
        if (!exception || writeAll) add(RULES.contentsWrite, jobId, permission.line);
        else {
          used.add(key);
          const actual = [...triggers].sort();
          const allowed = [...exception.allowedTriggers].sort();
          if (JSON.stringify(actual) !== JSON.stringify(allowed)) {
            add(["exception-trigger-mismatch", `exception triggers ${allowed.join(", ")} do not exactly match ${actual.join(", ")}`], jobId, permission.line);
          }
        }
      }
    }
    const executable = parseExecutable(lines);
    const text = executable.map(({ value }) => value).join("\n");
    const uses = executable.filter(({ kind }) => kind === "uses").map(({ value }) => value).join("\n");
    const publishes = DIRECT_PUSH.test(text) || SELF_COMMIT.test(text) || AUTO_COMMIT_ACTION.test(uses) || API_MUTATION.test(text);
    if (DIRECT_PUSH.test(text)) add(RULES.push, jobId);
    if (SELF_COMMIT.test(text)) add(RULES.commit, jobId);
    if (AUTO_COMMIT_ACTION.test(uses)) add(RULES.autoCommit, jobId);
    if (APPLY_PATCH.test(text)) add(RULES.applyPatch, jobId);
    if (ENCODED_PATCH_MARKER.test(text) || (BASE64_DECODE.test(text) && (APPLY_PATCH.test(text) || publishes))) add(RULES.encodedPatch, jobId);
    if (API_MUTATION.test(text)) add(RULES.apiMutation, jobId);
    if (SELF_DELETE.test(text)) add(RULES.selfDelete, jobId);
    if (REWRITE_COMMAND.test(text) && REPOSITORY_PATH.test(text) && publishes) add(RULES.rewrite, jobId);
  };
  inspectScope("<workflow>", workflowLines);
  for (const job of jobs) inspectScope(job.id, job.lines);

  for (const [key, exception] of allowlist) {
    if (exception.path !== normalizedPath) continue;
    if (!used.has(key)) add(["unused-exception", "exception does not match a contents:write scope"], exception.job);
  }
  return { path: normalizedPath, triggers: [...triggers].sort(), violations };
}

async function listWorkflowFiles(rootDir) {
  const entries = await readdir(path.join(rootDir, WORKFLOW_DIRECTORY), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && WORKFLOW_EXTENSION.test(entry.name))
    .map((entry) => `${WORKFLOW_DIRECTORY}/${entry.name}`).sort();
}

export async function scanWorkflowPolicy({ rootDir = process.cwd(), allowlistPath = DEFAULT_ALLOWLIST_PATH } = {}) {
  const allowlist = parseWorkflowPolicyAllowlist(await readFile(path.join(rootDir, allowlistPath), "utf8"));
  const workflowPaths = await listWorkflowFiles(rootDir);
  const results = [];
  for (const workflowPath of workflowPaths) {
    results.push(inspectWorkflow({ workflowPath, source: await readFile(path.join(rootDir, workflowPath), "utf8"), allowlist }));
  }
  const violations = results.flatMap((result) => result.violations);
  for (const exception of allowlist.values()) {
    if (!workflowPaths.includes(exception.path)) violations.push({ path: exception.path, jobId: exception.job, ruleId: "stale-exception", code: "stale-exception", reason: "exception workflow does not exist", message: "exception workflow does not exist", line: null });
  }
  return { workflowCount: workflowPaths.length, exceptionCount: allowlist.size, results, violations };
}

async function main() {
  const result = await scanWorkflowPolicy();
  if (result.violations.length) {
    console.error("Workflow policy violations:");
    for (const violation of result.violations) console.error(`- ${violation.path} job=${violation.jobId} [${violation.ruleId}] ${violation.reason}`);
    process.exitCode = 1;
  } else console.log(`Workflow policy passed: ${result.workflowCount} workflow(s), ${result.exceptionCount} exception(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
