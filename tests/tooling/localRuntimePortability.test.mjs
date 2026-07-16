import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, chownSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const bootstrapPath = path.join(repositoryRoot, "scripts/bootstrap-local-playwright.sh");
const syncPath = path.join(repositoryRoot, "scripts/sync-local-main.sh");
const runtimeWorkflowPath = path.join(repositoryRoot, ".github/workflows/local-playwright-runtime.yml");

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

test("local workspace scripts disable archive owner and permission restoration", () => {
  const bootstrap = readFileSync(bootstrapPath, "utf8");
  const sync = readFileSync(syncPath, "utf8");

  for (const [name, script] of [
    ["bootstrap", bootstrap],
    ["sync", sync],
  ]) {
    assert.match(
      script,
      /--no-same-owner --no-same-permissions/,
      `${name} must extract runner-owned artifacts as the current container user`,
    );
  }

  assert.equal(
    countMatches(bootstrap, /extract_portable_tgz "/g),
    2,
    "bootstrap must use portable extraction for source and browser artifacts",
  );
  assert.equal(
    countMatches(sync, /extract_portable_tgz "/g),
    2,
    "sync must use portable extraction for staged source and browser artifacts",
  );
  assert.match(
    sync,
    /tar --extract --file - --no-same-owner --no-same-permissions/,
    "sync workspace copy must not restore ownership from its intermediate tar stream",
  );
});

test(
  "portable extraction overrides runner ownership even when tar is configured to preserve it",
  { skip: process.platform !== "linux" },
  () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "tony-tar-portability-"));
    const source = path.join(temporary, "source");
    const oldDestination = path.join(temporary, "old");
    const portableDestination = path.join(temporary, "portable");
    const archive = path.join(temporary, "artifact.tgz");

    try {
      mkdirSync(source);
      mkdirSync(oldDestination);
      mkdirSync(portableDestination);
      writeFileSync(path.join(source, "file.txt"), "portable\n");
      chmodSync(temporary, 0o755);

      const currentUid = process.getuid?.() ?? 0;
      const currentGid = process.getgid?.() ?? 0;
      const extractionUid = currentUid === 0 ? 65534 : currentUid;
      const extractionGid = currentUid === 0 ? 65534 : currentGid;
      const archiveUid = extractionUid === 1001 ? 2001 : 1001;
      const archiveGid = extractionGid === 1001 ? 2001 : 1001;

      if (currentUid === 0) {
        chownSync(oldDestination, extractionUid, extractionGid);
        chownSync(portableDestination, extractionUid, extractionGid);
      }

      const createResult = spawnSync(
        "tar",
        [
          `--owner=${archiveUid}`,
          `--group=${archiveGid}`,
          "--numeric-owner",
          "-czf",
          archive,
          "-C",
          source,
          ".",
        ],
        { encoding: "utf8" },
      );
      assert.equal(createResult.status, 0, createResult.stderr);

      const childIdentity = currentUid === 0 ? { uid: extractionUid, gid: extractionGid } : {};
      const extractionEnvironment = {
        ...process.env,
        TAR_OPTIONS: "--same-owner",
      };

      const preservingResult = spawnSync(
        "tar",
        ["-xzf", archive, "-C", oldDestination],
        {
          ...childIdentity,
          env: extractionEnvironment,
          encoding: "utf8",
        },
      );
      assert.notEqual(
        preservingResult.status,
        0,
        "the fixture must reproduce the ownership failure before validating the fix",
      );
      assert.match(preservingResult.stderr, /Cannot change ownership|Operation not permitted/i);

      const portableResult = spawnSync(
        "tar",
        [
          "--extract",
          "--gzip",
          "--file",
          archive,
          "--directory",
          portableDestination,
          "--no-same-owner",
          "--no-same-permissions",
        ],
        {
          ...childIdentity,
          env: extractionEnvironment,
          encoding: "utf8",
        },
      );
      assert.equal(portableResult.status, 0, portableResult.stderr);

      const extracted = statSync(path.join(portableDestination, "file.txt"));
      assert.equal(extracted.uid, extractionUid);
      assert.equal(extracted.gid, extractionGid);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
}

function assertCommandSucceeded(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function createRuntimeArtifacts(temporary, sourceSha, { corruptRuntimeZip = false } = {}) {
  const source = path.join(temporary, "runtime-source");
  const browserSource = path.join(temporary, "browser-source");
  const runtimeTgz = path.join(temporary, "runtime.tgz");
  const browserTgz = path.join(temporary, "browsers.tgz");
  const runtimeZip = path.join(temporary, "runtime.zip");
  const browserZip = path.join(temporary, "browsers.zip");

  mkdirSync(path.join(source, "node_modules/@playwright/test"), { recursive: true });
  mkdirSync(path.join(browserSource, "ms-playwright/chromium"), { recursive: true });
  writeFileSync(path.join(source, ".local-runtime-sha"), `${sourceSha}\n`);
  writeFileSync(path.join(source, "package.json"), '{"name":"fixture","private":true,"type":"module"}\n');
  writeFileSync(
    path.join(source, "node_modules/@playwright/test/package.json"),
    '{"name":"@playwright/test","version":"1.54.1"}\n',
  );
  writeFileSync(path.join(source, "fixture.txt"), "verified runtime\n");
  writeFileSync(path.join(browserSource, "ms-playwright/chromium/READY"), "ready\n");

  assertCommandSucceeded(run("tar", ["-czf", runtimeTgz, "-C", source, "."]), "package runtime fixture");
  assertCommandSucceeded(run("tar", ["-czf", browserTgz, "-C", browserSource, "."]), "package browser fixture");

  if (corruptRuntimeZip) {
    writeFileSync(runtimeZip, "not a zip\n");
  } else {
    assertCommandSucceeded(run("zip", ["-q", runtimeZip, runtimeTgz]), "zip runtime fixture");
  }
  assertCommandSucceeded(run("zip", ["-q", browserZip, browserTgz]), "zip browser fixture");

  return { runtimeZip, browserZip };
}

function hashTree(root) {
  const digest = createHash("sha256");

  function visit(current, relative = "") {
    const entries = readdirSync(current).sort();
    for (const entry of entries) {
      const absolute = path.join(current, entry);
      const childRelative = path.posix.join(relative, entry);
      const metadata = lstatSync(absolute);
      digest.update(`${childRelative}\0${metadata.mode}\0${metadata.size}\0`);
      if (metadata.isDirectory()) {
        visit(absolute, childRelative);
      } else if (metadata.isSymbolicLink()) {
        digest.update(readlinkSync(absolute));
      } else {
        digest.update(readFileSync(absolute));
      }
    }
  }

  visit(root);
  return digest.digest("hex");
}

function generatedTestPath(name) {
  return path.join(repositoryRoot, ".local-runtime", `${name}-${process.pid}-${Date.now()}`);
}

test("bootstrap preserves active Git work across missing, stale, corrupt, and incomplete artifacts", () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "tony-active-workspace-"));
  const workspace = generatedTestPath("active-git-workspace");
  const browserRoot = generatedTestPath("active-git-browsers");
  const sourceSha = "a".repeat(40);
  const staleSha = "e".repeat(40);

  try {
    mkdirSync(workspace, { recursive: true });
    assertCommandSucceeded(run("git", ["init", "-q", workspace]), "initialize active Git fixture");
    assertCommandSucceeded(run("git", ["-C", workspace, "config", "user.name", "Fixture"]), "configure fixture name");
    assertCommandSucceeded(run("git", ["-C", workspace, "config", "user.email", "fixture@example.invalid"]), "configure fixture email");
    writeFileSync(path.join(workspace, "committed.txt"), "committed sprint work\n");
    assertCommandSucceeded(run("git", ["-C", workspace, "add", "committed.txt"]), "stage fixture commit");
    assertCommandSucceeded(run("git", ["-C", workspace, "commit", "-q", "-m", "fixture commit"]), "commit fixture work");
    writeFileSync(path.join(workspace, "uncommitted.txt"), "uncommitted sprint work\n");

    const staleFixture = path.join(temporary, "stale");
    const corruptFixture = path.join(temporary, "corrupt");
    const incompleteFixture = path.join(temporary, "incomplete");
    mkdirSync(staleFixture);
    mkdirSync(corruptFixture);
    mkdirSync(incompleteFixture);
    const staleArtifacts = createRuntimeArtifacts(staleFixture, staleSha);
    const corruptArtifacts = createRuntimeArtifacts(corruptFixture, sourceSha, { corruptRuntimeZip: true });
    const incompleteRuntimeZip = path.join(incompleteFixture, "runtime.zip");
    const incompleteText = path.join(incompleteFixture, "README.txt");
    writeFileSync(incompleteText, "no runtime bundle\n");
    assertCommandSucceeded(run("zip", ["-q", incompleteRuntimeZip, incompleteText]), "zip incomplete runtime fixture");

    const scenarios = [
      {
        label: "missing",
        runtimeZip: path.join(temporary, "missing-runtime.zip"),
        browserZip: path.join(temporary, "missing-browser.zip"),
      },
      { label: "stale", ...staleArtifacts },
      { label: "corrupt", ...corruptArtifacts },
      {
        label: "incomplete",
        runtimeZip: incompleteRuntimeZip,
        browserZip: staleArtifacts.browserZip,
      },
    ];

    const before = hashTree(workspace);
    const headBefore = run("git", ["-C", workspace, "rev-parse", "HEAD"]).stdout.trim();

    for (const scenario of scenarios) {
      const result = run("bash", [
        bootstrapPath,
        scenario.runtimeZip,
        scenario.browserZip,
        "--expected-main-sha",
        sourceSha,
        "--workspace",
        workspace,
        "--browser-root",
        browserRoot,
        "--force",
      ]);

      assert.notEqual(result.status, 0, `${scenario.label} artifacts must be rejected`);
      assert.match(result.stderr, /Refusing to bootstrap over an existing Git workspace/);
      assert.match(result.stderr, /--force flag cannot replace a destination containing \.git/);
      assert.equal(
        hashTree(workspace),
        before,
        `${scenario.label} artifact failure must leave committed and uncommitted work byte-for-byte unchanged`,
      );
      assert.equal(run("git", ["-C", workspace, "rev-parse", "HEAD"]).stdout.trim(), headBefore);
      assert.equal(existsSync(browserRoot), false, `${scenario.label} guard failure must not create browser output`);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
    rmSync(browserRoot, { recursive: true, force: true });
  }
});

test("bootstrap is new-output-only and --force cannot replace a non-Git destination", () => {
  const workspace = generatedTestPath("non-git-workspace");
  const browserRoot = generatedTestPath("non-git-browsers");
  const sourceSha = "b".repeat(40);

  try {
    mkdirSync(workspace, { recursive: true });
    writeFileSync(path.join(workspace, "keep.txt"), "keep me\n");
    const before = hashTree(workspace);
    const result = run("bash", [
      bootstrapPath,
      "missing-runtime.zip",
      "missing-browser.zip",
      "--expected-main-sha",
      sourceSha,
      "--workspace",
      workspace,
      "--browser-root",
      browserRoot,
      "--force",
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace destination is not empty/);
    assert.equal(hashTree(workspace), before);
    assert.equal(existsSync(browserRoot), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(browserRoot, { recursive: true, force: true });
  }
});

test("corrupt artifacts are fully rejected before new destinations are published", () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "tony-bootstrap-corrupt-"));
  const workspace = generatedTestPath("corrupt-workspace");
  const browserRoot = generatedTestPath("corrupt-browsers");
  const sourceSha = "c".repeat(40);

  try {
    const { runtimeZip, browserZip } = createRuntimeArtifacts(temporary, sourceSha, { corruptRuntimeZip: true });
    const result = run("bash", [
      bootstrapPath,
      runtimeZip,
      browserZip,
      "--expected-main-sha",
      sourceSha,
      "--workspace",
      workspace,
      "--browser-root",
      browserRoot,
    ]);

    assert.notEqual(result.status, 0);
    assert.equal(existsSync(workspace), false, "invalid runtime must not publish a workspace");
    assert.equal(existsSync(browserRoot), false, "invalid runtime must not publish a browser cache");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
    rmSync(browserRoot, { recursive: true, force: true });
  }
});

test("bootstrap stages and validates complete artifacts before publishing a new Git workspace", () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "tony-bootstrap-success-"));
  const workspace = generatedTestPath("new-workspace");
  const browserRoot = generatedTestPath("new-browsers");
  const sourceSha = "d".repeat(40);

  try {
    const { runtimeZip, browserZip } = createRuntimeArtifacts(temporary, sourceSha);
    const result = run("bash", [
      bootstrapPath,
      runtimeZip,
      browserZip,
      "--expected-main-sha",
      sourceSha,
      "--workspace",
      workspace,
      "--browser-root",
      browserRoot,
    ]);

    assertCommandSucceeded(result, "bootstrap valid fixture");
    assert.equal(readFileSync(path.join(workspace, ".local-runtime-sha"), "utf8").trim(), sourceSha);
    assert.equal(readFileSync(path.join(workspace, "fixture.txt"), "utf8"), "verified runtime\n");
    assert.equal(existsSync(path.join(workspace, ".git")), true);
    assert.equal(run("git", ["-C", workspace, "branch", "--show-current"]).stdout.trim(), "main");
    assert.equal(existsSync(path.join(browserRoot, "ms-playwright/chromium/READY")), true);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
    rmSync(browserRoot, { recursive: true, force: true });
  }
});

test("runtime workflow distinguishes new bootstrap from existing-workspace sync", () => {
  const workflow = readFileSync(runtimeWorkflowPath, "utf8");

  assert.doesNotMatch(
    workflow,
    /bootstrap-local-playwright\.sh[^\n]*--force/,
    "generated bootstrap instructions must not advertise destructive replacement",
  );
  assert.match(workflow, /For a new workspace, run `bash bootstrap-local-playwright\.sh/);
  assert.match(workflow, /For an existing Git workspace, run `bash scripts\/sync-local-main\.sh/);
  assert.match(workflow, /Never run bootstrap against a destination containing `\.git`/);
});
