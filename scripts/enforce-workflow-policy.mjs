import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inspectWorkflow, scanWorkflowPolicy } from "./check-workflow-policy.mjs";

const WORKFLOW_DIRECTORY = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/i;
export const YAML_ALIAS_RULE_ID = "yaml-anchor-alias-unsupported";
export const QUOTED_KEY_RULE_ID = "yaml-quoted-structural-key-unsupported";
const YAML_ALIAS_REASON = "YAML anchors and aliases are unsupported; expand workflow values explicitly";
const QUOTED_KEY_REASON = "quoted jobs, permissions, run, uses, and script keys are unsupported; use explicit unquoted workflow structure";

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

export function findYamlAnchorAliases(source) {
  const findings = [];
  let blockScalarIndent = null;
  const tokenPattern = /(?:^|:\s*|-\s*|[\[{,]\s*)([&*])([A-Za-z_][A-Za-z0-9_-]*)\b/g;
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
    for (const match of structuralLine.matchAll(tokenPattern)) {
      findings.push({
        line: index + 1,
        kind: match[1] === "&" ? "anchor" : "alias",
        name: match[2],
      });
    }
  }
  return findings;
}

export function findQuotedStructuralKeys(source) {
  const findings = [];
  let blockScalarIndent = null;
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const activeLine = stripInlineComment(rawLine);
    if (!activeLine.trim()) continue;
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
    if (match) findings.push({ line: index + 1, name: match[2] });
  }
  return findings;
}

function aliasViolation(workflowPath, finding) {
  const reason = `${YAML_ALIAS_REASON}: ${finding.kind} ${finding.name}`;
  return {
    path: normalizeRepositoryPath(workflowPath),
    jobId: "<workflow>",
    ruleId: YAML_ALIAS_RULE_ID,
    code: YAML_ALIAS_RULE_ID,
    reason,
    message: reason,
    line: finding.line,
  };
}

function quotedKeyViolation(workflowPath, finding) {
  const reason = `${QUOTED_KEY_REASON}: ${finding.name}`;
  return {
    path: normalizeRepositoryPath(workflowPath),
    jobId: "<workflow>",
    ruleId: QUOTED_KEY_RULE_ID,
    code: QUOTED_KEY_RULE_ID,
    reason,
    message: reason,
    line: finding.line,
  };
}

export function inspectWorkflowWithYamlSafety({ workflowPath, source, allowlist = new Map() }) {
  const findings = findYamlAnchorAliases(source);
  const quotedKeys = findQuotedStructuralKeys(source);
  if (findings.length > 0 || quotedKeys.length > 0) {
    return {
      path: normalizeRepositoryPath(workflowPath),
      triggers: [],
      violations: [
        ...findings.map((finding) => aliasViolation(workflowPath, finding)),
        ...quotedKeys.map((finding) => quotedKeyViolation(workflowPath, finding)),
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
  const aliasViolations = [];
  for (const workflowPath of workflowPaths) {
    const source = await readFile(path.join(rootDir, workflowPath), "utf8");
    for (const finding of findYamlAnchorAliases(source)) {
      aliasViolations.push(aliasViolation(workflowPath, finding));
    }
    for (const finding of findQuotedStructuralKeys(source)) {
      aliasViolations.push(quotedKeyViolation(workflowPath, finding));
    }
  }
  if (aliasViolations.length > 0) {
    return {
      workflowCount: workflowPaths.length,
      exceptionCount: 0,
      results: [],
      violations: aliasViolations,
    };
  }
  return scanWorkflowPolicy({ rootDir });
}

async function main() {
  const result = await enforceWorkflowPolicy();
  if (result.violations.length > 0) {
    console.error("Workflow policy violations:");
    for (const violation of result.violations) {
      console.error(`- ${violation.path} job=${violation.jobId} [${violation.ruleId}] ${violation.reason}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Workflow policy passed: ${result.workflowCount} workflow(s), ${result.exceptionCount} exception(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
