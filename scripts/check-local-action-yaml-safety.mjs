import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_ACTION_DIRECTORY = ".github/actions";
const ACTION_MANIFEST = /^action\.ya?ml$/i;

export const LOCAL_ACTION_QUOTED_KEY_RULE_ID = "local-action-quoted-key-unsupported";
export const LOCAL_ACTION_EXPLICIT_KEY_RULE_ID = "local-action-explicit-key-unsupported";
export const LOCAL_ACTION_TAG_RULE_ID = "local-action-yaml-tag-unsupported";

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

function maskQuotedScalarsAndComment(line) {
  let masked = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (!singleQuoted && !doubleQuoted && character === "#" && (index === 0 || /\s/.test(line[index - 1]))) return masked;
    if (doubleQuoted && character === "\\" && !escaped) {
      masked += " ";
      escaped = true;
      continue;
    }
    if (!escaped && character === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      masked += " ";
      continue;
    }
    if (!escaped && character === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      masked += " ";
      continue;
    }
    masked += singleQuoted || doubleQuoted ? " " : character;
    escaped = false;
  }
  return masked;
}

function finding(manifestPath, line, ruleId, reason) {
  return {
    path: normalizeRepositoryPath(manifestPath),
    line,
    jobId: "<local-action>",
    ruleId,
    code: ruleId,
    reason,
    message: reason,
  };
}

export function inspectLocalActionYamlSafety({ manifestPath, source }) {
  const findings = [];
  const lines = source.split(/\r?\n/);
  let blockScalarIndent = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (blockScalarIndent !== null) {
      if (!rawLine.trim() || indentation(rawLine) > blockScalarIndent) continue;
      blockScalarIndent = null;
    }

    const active = stripInlineComment(rawLine);
    if (!active.trim()) continue;

    if (/^\s*(?:-\s*)?(?:"[^"\r\n]+"|'[^'\r\n]+')\s*:/.test(active)) {
      findings.push(finding(manifestPath, index + 1, LOCAL_ACTION_QUOTED_KEY_RULE_ID, "quoted mapping keys are unsupported in local action manifests"));
      continue;
    }

    const masked = maskQuotedScalarsAndComment(rawLine);
    if (/^\s*(?:-\s*)?\?(?:\s|$)/.test(masked)) {
      findings.push(finding(manifestPath, index + 1, LOCAL_ACTION_EXPLICIT_KEY_RULE_ID, "explicit YAML mapping keys are unsupported in local action manifests"));
      continue;
    }

    if (/(?:^|:\s*|-\s+)!(?=\s|$|!|<|[A-Za-z0-9_-])/.test(masked)) {
      findings.push(finding(manifestPath, index + 1, LOCAL_ACTION_TAG_RULE_ID, "YAML tag properties, including bare non-specific tags, are unsupported in local action manifests"));
      continue;
    }

    if (/^\s*(?:-\s*)?[^:#]+:\s*[>|][+-]?\d*\s*$/.test(masked)) {
      blockScalarIndent = indentation(rawLine);
    }
  }

  return findings;
}

async function listActionManifests(rootDir) {
  const actionRoot = path.join(rootDir, LOCAL_ACTION_DIRECTORY);
  const manifests = [];

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile() && ACTION_MANIFEST.test(entry.name)) manifests.push(normalizeRepositoryPath(path.relative(rootDir, absolutePath)));
    }
  }

  await visit(actionRoot);
  return manifests.sort();
}

export async function scanLocalActionYamlSafety({ rootDir = process.cwd() } = {}) {
  const manifests = await listActionManifests(rootDir);
  const violations = [];
  for (const manifestPath of manifests) {
    const source = await readFile(path.join(rootDir, manifestPath), "utf8");
    violations.push(...inspectLocalActionYamlSafety({ manifestPath, source }));
  }
  return { manifestCount: manifests.length, violations };
}

async function main() {
  const result = await scanLocalActionYamlSafety();
  if (result.violations.length > 0) {
    console.error("Local action YAML safety violations:");
    for (const item of result.violations) console.error(`- ${item.path} line=${item.line} [${item.ruleId}] ${item.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Local action YAML safety passed: ${result.manifestCount} manifest(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
