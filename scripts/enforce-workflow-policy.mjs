import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inspectWorkflow, scanWorkflowPolicy } from "./check-workflow-policy.mjs";

const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/i;
export const YAML_ALIAS_RULE_ID = "yaml-anchor-alias-unsupported";
export const YAML_MERGE_RULE_ID = "yaml-merge-key-unsupported";
export const YAML_TAG_RULE_ID = "yaml-explicit-tag-unsupported";
export const YAML_FLOW_RULE_ID = "yaml-flow-policy-structure-unsupported";
export const QUOTED_KEY_RULE_ID = "yaml-quoted-structural-key-unsupported";
export const WRITE_LOCAL_RULE_ID = "write-job-local-executable";
const YAML_ALIAS_REASON = "YAML anchors and aliases are unsupported; expand workflow values explicitly";
const YAML_MERGE_REASON = "YAML merge keys are unsupported; expand inherited workflow mappings explicitly";
const YAML_TAG_REASON = "explicit YAML tags are unsupported in workflow policy inputs";
const YAML_FLOW_REASON = "flow-style jobs, job mappings, steps, and executable keys are unsupported; expand policy structure explicitly";
const QUOTED_KEY_REASON = "quoted policy-structural keys unsupported by the core extractor must be expanded explicitly";
const WRITE_LOCAL_REASON = "a contents:write job may not invoke repository-local scripts, package scripts, executables, or composite actions";

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

function stripQuotedSegments(line) {
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  let result = "";
  for (const character of line) {
    if (doubleQuoted && character === "\\" && !escaped) {
      escaped = true;
      result += " ";
      continue;
    }
    if (!escaped && character === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      result += " ";
      continue;
    }
    if (!escaped && character === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      result += " ";
      continue;
    }
    result += singleQuoted || doubleQuoted ? " " : character;
    escaped = false;
  }
  return result;
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

function structuralLines(source) {
  const result = [];
  let blockScalarIndent = null;
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const activeLine = stripInlineComment(rawLine);
    if (!activeLine.trim()) continue;
    const currentIndent = indentation(activeLine);
    if (blockScalarIndent !== null) {
      if (currentIndent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }
    const structuralLine = stripQuotedSegments(activeLine);
    if (/:\s*[|>][-+]?\s*$/.test(structuralLine)) {
      blockScalarIndent = currentIndent;
      continue;
    }
    result.push({ line: activeLine, structuralLine, index: index + 1 });
  }
  return result;
}

export function findYamlAnchorAliases(source) {
  const findings = [];
  const tokenPattern = /(?:^|:\s*|-\s*|[\[{,]\s*)([&*])([^\s\[\]{},]+)/g;
  for (const item of structuralLines(source)) {
    for (const match of item.structuralLine.matchAll(tokenPattern)) {
      findings.push({
        line: item.index,
        kind: match[1] === "&" ? "anchor" : "alias",
        name: match[2],
      });
    }
  }
  return findings;
}

export function findYamlMergeKeys(source) {
  const findings = [];
  for (const item of structuralLines(source)) {
    if (/^\s*(?:-\s*)?<<\s*:/.test(item.structuralLine) || /[{,]\s*<<\s*:/.test(item.structuralLine)) {
      findings.push({ line: item.index, name: "<<" });
    }
  }
  return findings;
}

export function findYamlExplicitTags(source) {
  const findings = [];
  const tagPattern = /(?:^|:\s*|-\s*|[\[{,]\s*)(!<[^>\r\n]+>|!![^\s\[\]{},]+|![^\s\[\]{},]+)/g;
  for (const item of structuralLines(source)) {
    for (const match of item.structuralLine.matchAll(tagPattern)) {
      findings.push({ line: item.index, name: match[1] });
    }
  }
  return findings;
}

export function findUnsupportedFlowStylePolicy(source) {
  const findings = [];
  const lines = activeLines(source);
  for (const item of structuralLines(source)) {
    if (/^\s*jobs\s*:\s*[\[{]/.test(item.structuralLine)) {
      findings.push({ line: item.index, name: "jobs" });
      continue;
    }
    if (/^\s*steps\s*:\s*\[/.test(item.structuralLine)) {
      findings.push({ line: item.index, name: "steps" });
      continue;
    }
    const executable = item.structuralLine.match(/[\[{,]\s*(run|uses|script)\s*:/);
    if (executable) findings.push({ line: item.index, name: executable[1] });
  }

  const jobsIndex = lines.findIndex(({ line }) => /^\s*jobs\s*:\s*$/.test(line));
  if (jobsIndex !== -1) {
    const jobsBlock = collectBlock(lines, jobsIndex, indentation(lines[jobsIndex].line));
    const mappingLines = jobsBlock.filter(({ line }) => /^\s*[A-Za-z0-9_-]+\s*:/.test(line));
    const jobIndent = mappingLines.length > 0
      ? Math.min(...mappingLines.map(({ line }) => indentation(line)))
      : null;
    if (jobIndent !== null) {
      for (const item of mappingLines) {
        if (indentation(item.line) === jobIndent && /^\s*[A-Za-z0-9_-]+\s*:\s*\{/.test(item.line)) {
          findings.push({ line: item.index, name: "job" });
        }
      }
    }
  }
  return findings;
}

export function findQuotedStructuralKeys(source) {
  const findings = [];
  const lines = activeLines(source);
  let blockScalarIndent = null;
  for (let index = 0; index < lines.length; index += 1) {
    const activeLine = lines[index].line;
    const currentIndent = indentation(activeLine);
    if (blockScalarIndent !== null) {
      if (currentIndent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }
    if (/:\s*[|>][-+]?\s*$/.test(stripQuotedSegments(activeLine))) {
      blockScalarIndent = currentIndent;
      continue;
    }
    const match = activeLine.match(/^\s*(?:-\s*)?(["'])(jobs|permissions|run|uses|script)\1\s*:/)
      || activeLine.match(/[{,]\s*(["'])(jobs|permissions|run|uses|script)\1\s*:/);
    if (match) findings.push({ line: lines[index].index, name: match[2] });
  }

  const jobsIndex = lines.findIndex(({ line }) => /^\s*jobs\s*:/.test(line));
  if (jobsIndex !== -1) {
    const jobsIndent = indentation(lines[jobsIndex].line);
    const jobsBlock = collectBlock(lines, jobsIndex, jobsIndent);
    const jobIndent = jobsBlock.find(({ line }) => /^\s*(?:["'][^"']+["']|[A-Za-z0-9_-]+)\s*:/.test(line));
    if (jobIndent) {
      const expectedIndent = indentation(jobIndent.line);
      for (const item of jobsBlock) {
        const match = item.line.match(/^\s*(["'])([^"']+)\1\s*:/);
        if (match && indentation(item.line) === expectedIndent) {
          findings.push({ line: item.index, name: `job:${match[2]}` });
        }
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const permission = lines[index].line.match(/^\s*permissions\s*:\s*$/);
    if (!permission) continue;
    const parentIndent = indentation(lines[index].line);
    for (const child of collectBlock(lines, index, parentIndent)) {
      const match = child.line.match(/^\s*(["'])([^"']+)\1\s*:/);
      if (match) findings.push({ line: child.index, name: `permission:${match[2]}` });
    }
  }

  return findings;
}

function parseInlinePermissions(value) {
  const match = value.match(/\{([\s\S]*)\}/);
  if (!match) return false;
  return match[1].split(",").some((entry) => /^\s*["']?contents["']?\s*:\s*["']?write["']?\s*$/.test(entry));
}

function jobRequestsContentsWrite(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].line.match(/^\s*permissions\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    if (/^write-all$/.test(match[1].trim()) || parseInlinePermissions(match[1])) return true;
    for (const child of collectBlock(lines, index, indentation(lines[index].line))) {
      if (/^\s*contents\s*:\s*write\s*$/.test(child.line)) return true;
    }
  }
  return false;
}

function executableValues(lines) {
  const values = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].line.match(/^\s*(?:-\s*)?(run|uses|script)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (/^[|>][-+]?\s*$/.test(value)) {
      value = collectBlock(lines, index, indentation(lines[index].line)).map(({ line }) => line.trim()).join("\n");
    }
    values.push({ kind: match[1], value: value.replace(/^["']|["']$/g, ""), line: lines[index].index });
  }
  return values;
}

function isLocalRun(value) {
  const packageCommand = /(?:^|[\s;&|])(?:(?:npm|pnpm|yarn|bun)\s+(?:run|exec|dlx)\b|(?:npx|bunx)\b)/im;
  const interpreterCommand = /(?:^|[\s;&|])(?:node|python3?|bash|sh|zsh|pwsh|ruby|perl|deno|tsx)\b/im;
  const taskRunner = /(?:^|[\s;&|])(?:make|just|task|mage|rake|gradle|mvn|ant|cargo\s+run|go\s+run|dotnet\s+run|composer\s+run|poetry\s+run|uv\s+run|pipenv\s+run|bundle\s+exec)\b/im;
  const repositoryPath = /(?:^|[\s("'=;&|])(?:\.{1,2}\/|(?:scripts|tools|src|tests|docs|\.github)\/|(?:package\.json|Makefile|Justfile|Taskfile\.ya?ml)\b)/im;
  const sourceCommand = /(?:^|[\s;&|])(?:source|\.)\s+[^\s;&|]+/im;
  return packageCommand.test(value)
    || interpreterCommand.test(value)
    || taskRunner.test(value)
    || repositoryPath.test(value)
    || sourceCommand.test(value);
}

function scriptLoadsModulesOrFiles(value) {
  return /\brequire\s*\(|\bimport\s*\(|\bimport\s+[^;\n]+\s+from\s+|\bprocess\.cwd\s*\(|\b(?:process\.env\.)?GITHUB_WORKSPACE\b|\bfileURLToPath\s*\(|\b(?:fs|path)\.(?:readFile|readFileSync|createReadStream|open|openSync|resolve|join)\s*\(|\b(?:readFile|readFileSync|createReadStream|openSync)\s*\(/im.test(value);
}

export function findWriteJobLocalExecutables(source) {
  const findings = [];
  const lines = activeLines(source);
  const jobsIndex = lines.findIndex(({ line }) => /^\s*jobs\s*:/.test(line));
  if (jobsIndex === -1) return findings;
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
    if (!jobRequestsContentsWrite(jobLines)) continue;
    for (const executable of executableValues(jobLines)) {
      const local = executable.kind === "uses"
        ? /^\.{1,2}\//.test(executable.value)
        : executable.kind === "script"
          ? scriptLoadsModulesOrFiles(executable.value) || isLocalRun(executable.value)
          : isLocalRun(executable.value);
      if (local) findings.push({ line: executable.line, jobId: start.id, value: executable.value });
    }
  }
  return findings;
}

function violation(workflowPath, ruleId, reason, line, jobId = "<workflow>") {
  return {
    path: normalizeRepositoryPath(workflowPath),
    jobId,
    ruleId,
    code: ruleId,
    reason,
    message: reason,
    line,
  };
}

function aliasViolation(workflowPath, finding) {
  return violation(
    workflowPath,
    YAML_ALIAS_RULE_ID,
    `${YAML_ALIAS_REASON}: ${finding.kind} ${finding.name}`,
    finding.line,
  );
}

function mergeViolation(workflowPath, finding) {
  return violation(workflowPath, YAML_MERGE_RULE_ID, YAML_MERGE_REASON, finding.line);
}

function tagViolation(workflowPath, finding) {
  return violation(workflowPath, YAML_TAG_RULE_ID, `${YAML_TAG_REASON}: ${finding.name}`, finding.line);
}

function flowViolation(workflowPath, finding) {
  return violation(workflowPath, YAML_FLOW_RULE_ID, `${YAML_FLOW_REASON}: ${finding.name}`, finding.line);
}

function quotedKeyViolation(workflowPath, finding) {
  return violation(workflowPath, QUOTED_KEY_RULE_ID, `${QUOTED_KEY_REASON}: ${finding.name}`, finding.line);
}

function localExecutableViolation(workflowPath, finding) {
  return violation(workflowPath, WRITE_LOCAL_RULE_ID, WRITE_LOCAL_REASON, finding.line, finding.jobId);
}

export function inspectWorkflowWithYamlSafety({ workflowPath, source, allowlist = new Map() }) {
  const aliases = findYamlAnchorAliases(source);
  const mergeKeys = aliases.length === 0 ? findYamlMergeKeys(source) : [];
  const tags = findYamlExplicitTags(source);
  const flowStructures = findUnsupportedFlowStylePolicy(source);
  const quotedKeys = findQuotedStructuralKeys(source);
  const localExecutables = findWriteJobLocalExecutables(source);
  if (aliases.length > 0 || mergeKeys.length > 0 || tags.length > 0 || flowStructures.length > 0 || quotedKeys.length > 0 || localExecutables.length > 0) {
    return {
      path: normalizeRepositoryPath(workflowPath),
      triggers: [],
      violations: [
        ...aliases.map((finding) => aliasViolation(workflowPath, finding)),
        ...mergeKeys.map((finding) => mergeViolation(workflowPath, finding)),
        ...tags.map((finding) => tagViolation(workflowPath, finding)),
        ...flowStructures.map((finding) => flowViolation(workflowPath, finding)),
        ...quotedKeys.map((finding) => quotedKeyViolation(workflowPath, finding)),
        ...localExecutables.map((finding) => localExecutableViolation(workflowPath, finding)),
      ],
    };
  }
  return inspectWorkflow({ workflowPath, source, allowlist });
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

export async function enforceWorkflowPolicy({ rootDir = process.cwd() } = {}) {
  const workflowPaths = await listWorkflowFiles(rootDir);
  const preflightViolations = [];
  for (const workflowPath of workflowPaths) {
    const source = await readFile(path.join(rootDir, workflowPath), "utf8");
    const result = inspectWorkflowWithYamlSafety({ workflowPath, source });
    if (result.violations.length > 0) preflightViolations.push(...result.violations);
  }
  if (preflightViolations.length > 0) {
    return {
      workflowCount: workflowPaths.length,
      exceptionCount: 0,
      results: [],
      violations: preflightViolations,
    };
  }
  return scanWorkflowPolicy({ rootDir });
}

async function main() {
  const result = await enforceWorkflowPolicy();
  if (result.violations.length > 0) {
    console.error("Workflow policy violations:");
    for (const item of result.violations) {
      console.error(`- ${item.path} job=${item.jobId} [${item.ruleId}] ${item.reason}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Workflow policy passed: ${result.workflowCount} workflow(s), ${result.exceptionCount} exception(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
