import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/i;

export const WRITE_GITHUB_SCRIPT_RULE_ID = "write-job-github-script-unsupported";
const WRITE_GITHUB_SCRIPT_REASON = "a contents:write job may not use actions/github-script";

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
    if (!singleQuoted && !doubleQuoted && character === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
    escaped = false;
  }
  return line;
}

function activeLines(source) {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line: stripInlineComment(line), index: index + 1 }))
    .filter(({ line }) => line.trim().length > 0);
}

function collectBlock(lines, start, parentIndent) {
  const result = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (indentation(lines[index].line) <= parentIndent) break;
    result.push(lines[index]);
  }
  return result;
}

function parseInlinePermissions(value) {
  const match = value.match(/\{([\s\S]*)\}/);
  if (!match) return false;
  return match[1].split(",").some((entry) => /^\s*["']?contents["']?\s*:\s*["']?write["']?\s*$/.test(entry));
}

function permissionState(lines, requiredIndent = null) {
  for (let index = 0; index < lines.length; index += 1) {
    if (requiredIndent !== null && indentation(lines[index].line) !== requiredIndent) continue;
    const match = lines[index].line.match(/^\s*permissions\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    if (/^write-all$/.test(match[1].trim()) || parseInlinePermissions(match[1])) {
      return { declared: true, contentsWrite: true };
    }
    const block = collectBlock(lines, index, indentation(lines[index].line));
    return {
      declared: true,
      contentsWrite: block.some(({ line }) => /^\s*contents\s*:\s*write\s*$/.test(line)),
    };
  }
  return { declared: false, contentsWrite: false };
}

function githubScriptUse(lines) {
  for (const item of lines) {
    const match = item.line.match(/^\s*(?:-\s*)?uses\s*:\s*["']?(actions\/github-script@[^\s"']+)["']?\s*$/i);
    if (match) return { line: item.index, value: match[1] };
  }
  return null;
}

export function inspectWriteGithubScriptPolicy({ workflowPath, source }) {
  const findings = [];
  const lines = activeLines(source);
  const jobsIndex = lines.findIndex(({ line }) => /^\s*jobs\s*:\s*$/.test(line));
  if (jobsIndex === -1) return findings;

  const workflowPermissions = permissionState(lines.slice(0, jobsIndex), 0);
  const jobsBlock = collectBlock(lines, jobsIndex, indentation(lines[jobsIndex].line));
  let jobIndent = null;
  const starts = [];
  for (let index = 0; index < jobsBlock.length; index += 1) {
    const match = jobsBlock[index].line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*$/);
    if (!match) continue;
    const currentIndent = indentation(jobsBlock[index].line);
    if (jobIndent === null) jobIndent = currentIndent;
    if (currentIndent === jobIndent) starts.push({ index, id: match[1] });
  }

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const jobLines = jobsBlock.slice(start.index + 1, starts[index + 1]?.index ?? jobsBlock.length);
    const jobPermissions = permissionState(jobLines);
    const contentsWrite = jobPermissions.declared
      ? jobPermissions.contentsWrite
      : workflowPermissions.contentsWrite;
    if (!contentsWrite) continue;
    const use = githubScriptUse(jobLines);
    if (!use) continue;
    findings.push({
      path: normalizeRepositoryPath(workflowPath),
      jobId: start.id,
      ruleId: WRITE_GITHUB_SCRIPT_RULE_ID,
      code: WRITE_GITHUB_SCRIPT_RULE_ID,
      reason: WRITE_GITHUB_SCRIPT_REASON,
      message: WRITE_GITHUB_SCRIPT_REASON,
      line: use.line,
    });
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
      else if (entry.isFile() && WORKFLOW_EXTENSION.test(entry.name)) {
        workflowPaths.push(normalizeRepositoryPath(path.relative(rootDir, absolutePath)));
      }
    }
  }
  await visit(workflowRoot);
  return workflowPaths.sort();
}

export async function scanWriteGithubScriptPolicy({ rootDir = process.cwd() } = {}) {
  const workflowPaths = await listWorkflowFiles(rootDir);
  const violations = [];
  for (const workflowPath of workflowPaths) {
    const source = await readFile(path.join(rootDir, workflowPath), "utf8");
    violations.push(...inspectWriteGithubScriptPolicy({ workflowPath, source }));
  }
  return { workflowCount: workflowPaths.length, violations };
}

async function main() {
  const result = await scanWriteGithubScriptPolicy();
  if (result.violations.length > 0) {
    console.error("Workflow GitHub Script policy violations:");
    for (const item of result.violations) {
      console.error(`- ${item.path} job=${item.jobId} [${item.ruleId}] ${item.reason}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Workflow GitHub Script policy passed: ${result.workflowCount} workflow(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
