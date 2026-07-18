import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_ALLOWLIST_PATH = ".github/workflow-policy-allowlist.json";
const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/i;
const WRITE_PERMISSION = /\bcontents\s*:\s*write\b/im;
const WRITE_ALL_PERMISSION = /(?:^|\n)\s*permissions\s*:\s*write-all\b/im;
const DIRECT_PUSH = /(?:^|[\s;&|])git\s+(?:-[^\s]+\s+)*push(?:\s|$)/im;
const SELF_COMMIT = /(?:^|[\s;&|])git\s+(?:-[^\s]+\s+)*commit(?:\s|$)/im;
const APPLY_PATCH = /(?:^|[\s;&|])(?:git\s+apply|patch\s+-p\d*|apply_patch)(?:\s|$)/im;
const ENCODED_PATCH_MARKER = /\b(?:PATCH_GZIP_BASE64|PATCH_BASE64|BASE64_PATCH|ENCODED_PATCH|PATCH_PAYLOAD_BASE64)\b/im;
const BASE64_DECODE = /\bbase64\s+(?:--decode|-d)\b/im;
const SELF_DELETE = /(?:git\s+rm|\brm\s+-[^\n]*|\brm\s+)\s*[^\n]*(?:\.github\/workflows\/|\$\{\{\s*github\.workflow_ref\s*\}\})/im;
const REWRITE_COMMAND = /\b(?:sed|perl|python|node|tee|cat)\b/im;
const REPOSITORY_PATH = /(?:src\/|tests\/|docs\/|scripts\/|game\.js|package\.json|\.github\/workflows\/)/im;

function normalizeRepositoryPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function stripCommentOnlyLines(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

function indentation(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

export function extractWorkflowTriggers(source) {
  const lines = stripCommentOnlyLines(source).split(/\r?\n/);
  const triggers = new Set();
  const onIndex = lines.findIndex((line) => /^\s*["']?on["']?\s*:/.test(line));
  if (onIndex === -1) return triggers;

  const onLine = lines[onIndex];
  const onIndent = indentation(onLine);
  const inline = onLine.replace(/^\s*["']?on["']?\s*:\s*/, "").trim();
  for (const name of ["pull_request", "pull_request_target", "push", "workflow_dispatch", "workflow_call", "schedule", "release"]) {
    if (new RegExp(`(?:^|[\\s\\[,])${name}(?:$|[\\s\\],])`).test(inline)) triggers.add(name);
  }

  for (let index = onIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const currentIndent = indentation(line);
    if (currentIndent <= onIndent && /^\s*[\w"'-]+\s*:/.test(line)) break;
    const match = line.match(/^\s*(pull_request_target|pull_request|push|workflow_dispatch|workflow_call|schedule|release)\s*:/);
    if (match) triggers.add(match[1]);
  }

  return triggers;
}

function validateException(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError(`workflow policy exception ${index} must be an object`);
  }
  const workflowPath = normalizeRepositoryPath(entry.path ?? "");
  if (!workflowPath.startsWith(`${WORKFLOW_DIRECTORY}/`) || !WORKFLOW_EXTENSION.test(workflowPath)) {
    throw new TypeError(`workflow policy exception ${index} requires an exact .github/workflows/*.yml path`);
  }
  for (const field of ["owner", "reason", "reviewIssue"]) {
    if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
      throw new TypeError(`workflow policy exception ${index} requires ${field}`);
    }
  }
  if (!Array.isArray(entry.allowedTriggers) || entry.allowedTriggers.length === 0) {
    throw new TypeError(`workflow policy exception ${index} requires allowedTriggers`);
  }
  const validTriggers = new Set(["pull_request", "pull_request_target", "push", "workflow_dispatch", "workflow_call", "schedule", "release"]);
  const invalidTriggers = entry.allowedTriggers.filter((trigger) => !validTriggers.has(trigger));
  if (invalidTriggers.length > 0) {
    throw new TypeError(`workflow policy exception ${index} has unsupported triggers: ${invalidTriggers.join(", ")}`);
  }
  if (!Array.isArray(entry.permissions) || !entry.permissions.includes("contents:write")) {
    throw new TypeError(`workflow policy exception ${index} must explicitly allow contents:write`);
  }
  return {
    ...entry,
    path: workflowPath,
    allowedTriggers: new Set(entry.allowedTriggers),
  };
}

export function parseWorkflowPolicyAllowlist(source) {
  const parsed = JSON.parse(source);
  if (parsed?.version !== 1) throw new TypeError("workflow policy allowlist version must be 1");
  if (!Array.isArray(parsed.exceptions)) throw new TypeError("workflow policy allowlist exceptions must be an array");
  const exceptions = parsed.exceptions.map(validateException);
  const duplicate = exceptions.find((entry, index) => exceptions.findIndex((candidate) => candidate.path === entry.path) !== index);
  if (duplicate) throw new TypeError(`duplicate workflow policy exception: ${duplicate.path}`);
  return new Map(exceptions.map((entry) => [entry.path, entry]));
}

export function inspectWorkflow({ workflowPath, source, allowlist = new Map() }) {
  const normalizedPath = normalizeRepositoryPath(workflowPath);
  const activeSource = stripCommentOnlyLines(source);
  const triggers = extractWorkflowTriggers(activeSource);
  const exception = allowlist.get(normalizedPath) ?? null;
  const violations = [];
  const add = (code, message) => violations.push({ path: normalizedPath, code, message });

  const requestsContentsWrite = WRITE_PERMISSION.test(activeSource) || WRITE_ALL_PERMISSION.test(activeSource);
  if (requestsContentsWrite) {
    if (!exception) {
      add("unallowlisted-contents-write", "contents: write requires an exact path-scoped policy exception");
    } else {
      const disallowedTriggers = [...triggers].filter((trigger) => !exception.allowedTriggers.has(trigger));
      if (disallowedTriggers.length > 0) {
        add("exception-trigger-mismatch", `allowlist does not cover triggers: ${disallowedTriggers.join(", ")}`);
      }
    }
  }

  if (exception && !requestsContentsWrite) {
    add("unused-exception", "allowlist entry exists but the workflow does not request contents: write");
  }

  const publishesRepositoryChanges = SELF_COMMIT.test(activeSource) || DIRECT_PUSH.test(activeSource);
  const decodesPatchPayload = ENCODED_PATCH_MARKER.test(activeSource)
    || (BASE64_DECODE.test(activeSource) && (APPLY_PATCH.test(activeSource) || publishesRepositoryChanges));
  const rewritesRepository = REWRITE_COMMAND.test(activeSource) && REPOSITORY_PATH.test(activeSource);

  if (DIRECT_PUSH.test(activeSource)) add("direct-git-push", "workflows may not push repository changes directly");
  if (SELF_COMMIT.test(activeSource)) add("workflow-self-commit", "workflows may not create repository commits");
  if (APPLY_PATCH.test(activeSource)) add("source-patch-application", "workflows may not apply source patches");
  if (decodesPatchPayload) add("encoded-patch-transport", "encoded patch payloads or patch decode steps are prohibited");
  if (SELF_DELETE.test(activeSource)) add("workflow-self-delete", "workflows may not delete themselves or workflow transport files");
  if (rewritesRepository && publishesRepositoryChanges) {
    add("rewrite-and-publish", "workflow rewrites repository source/tests/docs and attempts to publish the result");
  }

  return {
    path: normalizedPath,
    triggers: [...triggers].sort(),
    hasContentsWrite: requestsContentsWrite,
    allowlisted: Boolean(exception),
    violations,
  };
}

async function listWorkflowFiles(rootDir) {
  const directory = path.join(rootDir, WORKFLOW_DIRECTORY);
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && WORKFLOW_EXTENSION.test(entry.name))
    .map((entry) => normalizeRepositoryPath(path.join(WORKFLOW_DIRECTORY, entry.name)))
    .sort();
}

export async function scanWorkflowPolicy({
  rootDir = process.cwd(),
  allowlistPath = DEFAULT_ALLOWLIST_PATH,
} = {}) {
  const allowlistSource = await readFile(path.join(rootDir, allowlistPath), "utf8");
  const allowlist = parseWorkflowPolicyAllowlist(allowlistSource);
  const workflowPaths = await listWorkflowFiles(rootDir);
  const results = [];

  for (const workflowPath of workflowPaths) {
    const source = await readFile(path.join(rootDir, workflowPath), "utf8");
    results.push(inspectWorkflow({ workflowPath, source, allowlist }));
  }

  const missingExceptions = [...allowlist.keys()].filter((workflowPath) => !workflowPaths.includes(workflowPath));
  const violations = results.flatMap((result) => result.violations);
  for (const workflowPath of missingExceptions) {
    violations.push({
      path: workflowPath,
      code: "stale-exception",
      message: "allowlist entry does not match an existing workflow file",
    });
  }

  return {
    workflowCount: workflowPaths.length,
    exceptionCount: allowlist.size,
    results,
    violations,
  };
}

async function main() {
  const result = await scanWorkflowPolicy();
  if (result.violations.length > 0) {
    console.error("Workflow policy violations:");
    for (const violation of result.violations) {
      console.error(`- ${violation.path} [${violation.code}] ${violation.message}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Workflow policy passed: ${result.workflowCount} workflow(s), ${result.exceptionCount} exception(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await main();
}
