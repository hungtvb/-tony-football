import assert from "node:assert/strict";
import test from "node:test";

import { parseWorkflowPolicyAllowlist } from "../../scripts/check-workflow-policy.mjs";
import {
  inspectWorkflowWithYamlSafety,
  WRITE_LOCAL_RULE_ID,
  YAML_ALIAS_RULE_ID,
  YAML_MERGE_RULE_ID,
  YAML_TAG_RULE_ID,
} from "../../scripts/enforce-workflow-policy.mjs";

const anchor = (name) => ["&", name].join("");
const alias = (name) => ["*", name].join("");
const yaml = (...lines) => `${lines.join("\n")}\n`;

function assertAliasBlocked(result) {
  assert.ok(result.violations.length >= 2);
  assert.ok(result.violations.every(({ code, jobId, line, reason }) => (
    code === YAML_ALIAS_RULE_ID
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
  assertAliasBlocked(inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/aliased-permissions.yml", source }));
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
  assertAliasBlocked(inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/aliased-job.yaml", source }));
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
  assertAliasBlocked(inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/aliased-merge.yml", source }));
});

test("merge keys without aliases and explicit tags also fail closed", () => {
  const merged = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/inline-merge.yml",
    source: yaml("on: [workflow_dispatch]", "jobs:", "  publish:", "    <<: { permissions: { contents: write } }", "    runs-on: ubuntu-latest"),
  });
  assert.deepEqual(merged.violations.map(({ code }) => code), [YAML_MERGE_RULE_ID]);

  const tagged = inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/tagged.yml",
    source: yaml("on: [workflow_dispatch]", "jobs:", "  publish: !custom", "    runs-on: ubuntu-latest"),
  });
  assert.deepEqual(tagged.violations.map(({ code }) => code), [YAML_TAG_RULE_ID]);
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
  assert.deepEqual(inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/literals.yml", source }).violations, []);
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
  const result = inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/quoted-keys.yml", source });
  assert.ok(result.violations.length > 0);
  assert.ok(result.violations.every(({ code }) => code === "yaml-quoted-structural-key-unsupported"));
});

test("quoted job IDs and block permission names fail closed", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    '  "publish":',
    "    permissions:",
    '      "contents": write',
    "    runs-on: ubuntu-latest",
  );
  const result = inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/quoted-scope.yml", source });
  assert.deepEqual(result.violations.map(({ code }) => code), [
    "yaml-quoted-structural-key-unsupported",
    "yaml-quoted-structural-key-unsupported",
  ]);
});

test("write jobs reject all repository-local command and action variants", () => {
  const variants = [
    "pnpm run publish",
    "yarn run publish",
    "bun run publish",
    "npx tsx ./publish.mjs",
    "node ./publish.mjs",
    "bash ../release.sh",
    "./publish.sh",
    "source scripts/release.sh",
    "make publish",
    "node -e \"await import('./publish.mjs')\"",
    "python -c \"exec(open('publish.py').read())\"",
  ];
  for (const command of variants) {
    const source = yaml(
      "on: [workflow_dispatch]",
      "jobs:",
      "  publish:",
      "    permissions: { contents: write }",
      "    runs-on: ubuntu-latest",
      "    steps:",
      `      - run: ${command}`,
    );
    const result = inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/local.yml", source });
    assert.deepEqual(result.violations.map(({ code }) => code), [WRITE_LOCAL_RULE_ID], command);
  }

  const actionSource = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    "  publish:",
    "    permissions: { contents: write }",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: ./.github/actions/publish",
  );
  assert.deepEqual(
    inspectWorkflowWithYamlSafety({ workflowPath: ".github/workflows/local-action.yml", source: actionSource }).violations.map(({ code }) => code),
    [WRITE_LOCAL_RULE_ID],
  );
});

test("local execution remains allowed in a separate read-only job", () => {
  const source = yaml(
    "on: [workflow_dispatch]",
    "jobs:",
    "  publish:",
    "    permissions: { contents: write }",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: gh release create v1 asset.zip",
    "  validate:",
    "    permissions: { contents: read }",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: npm test",
  );
  const allowlist = parseWorkflowPolicyAllowlist(JSON.stringify({
    version: 1,
    exceptions: [{
      path: ".github/workflows/scoped.yml",
      job: "publish",
      owner: "release-maintainers",
      reason: "Publish reviewed release assets",
      reviewIssue: "TON-16",
      allowedTriggers: ["workflow_dispatch"],
      permissions: ["contents:write"],
    }],
  }));
  assert.deepEqual(inspectWorkflowWithYamlSafety({
    workflowPath: ".github/workflows/scoped.yml",
    source,
    allowlist,
  }).violations, []);
});
