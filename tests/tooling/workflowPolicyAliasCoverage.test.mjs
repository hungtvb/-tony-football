import assert from "node:assert/strict";
import test from "node:test";

import { inspectWorkflowWithYamlSafety } from "../../scripts/enforce-workflow-policy.mjs";

const anchor = (name) => ["&", name].join("");
const alias = (name) => ["*", name].join("");
const yaml = (...lines) => `${lines.join("\n")}\n`;

function assertAliasBlocked(result) {
  assert.ok(result.violations.length >= 2);
  assert.ok(result.violations.every(({ code, jobId, line, reason }) => (
    code === "yaml-anchor-alias-unsupported"
    && jobId === "<workflow>"
    && Number.isInteger(line)
    && /(?:anchor|alias)/.test(reason)
  )));
  assert.deepEqual(result.triggers, []);
}

test("aliased permission maps fail closed before permission inspection", () => {
  const source = yaml(
    "name: Aliased permissions",
    "on: [pull_request_target]",
    "jobs:",
    "  template:",
    `    permissions: ${anchor("write_permissions")}`,
    "      contents: write",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: echo template",
    "  publish:",
    `    permissions: ${alias("write_permissions")}`,
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: echo publish",
  );
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/aliased-permissions.yml",
    source,
  });
  assertAliasBlocked(result);
});

test("aliased executable job content fails closed before job inspection", () => {
  const source = yaml(
    "name: Aliased publisher job",
    "on: [push]",
    "jobs:",
    `  publisher: ${anchor("publisher_job")}`,
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: echo generated",
    `  publish: ${alias("publisher_job")}`,
  );
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/aliased-job.yaml",
    source,
  });
  assertAliasBlocked(result);
});

test("YAML merge-key aliases fail closed before inherited job inspection", () => {
  const source = yaml(
    "on: [push]",
    "jobs:",
    `  template: ${anchor("publisher_job")}`,
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: echo generated",
    "  publish:",
    `    <<: ${alias("publisher_job")}`,
  );
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/aliased-merge.yml",
    source,
  });
  assertAliasBlocked(result);
});

test("anchor-like text in quoted scalars, comments and block scripts is not YAML alias syntax", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    `name: "literal ${anchor("anchor")} and ${alias("alias")}"`,
    "jobs:",
    "  inspect:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    `      # permissions: ${alias("write_permissions")}`,
    "      - run: |",
    `          echo '${anchor("anchor")}'`,
    `          echo "${alias("alias")}"`,
    `      - run: echo '${alias("inline_alias")}'`,
  );
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/literals.yml",
    source,
  });
  assert.deepEqual(result.violations, []);
});

test("quoted jobs, permissions and run keys fail closed before extraction", () => {
  const source = yaml(
    "name: Quoted keys",
    "on: [workflow_dispatch]",
    "permissions:",
    "  contents: read",
    '"jobs":',
    "  publish:",
    '    "permissions":',
    "      contents: write",
    "    runs-on: ubuntu-latest",
    "    steps:",
    '      - "run": git push origin HEAD:main',
  );
  const result = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/quoted-keys.yml",
    source,
  });
  assert.ok(result.violations.length > 0);
  assert.ok(result.violations.every(({ code, jobId, line, reason }) => (
    code === "yaml-quoted-structural-key-unsupported"
    && jobId === "<workflow>"
    && Number.isInteger(line)
    && /quoted/.test(reason)
  )));
  assert.deepEqual(result.triggers, []);
});
