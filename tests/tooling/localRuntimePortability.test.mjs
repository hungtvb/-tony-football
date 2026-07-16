import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, chownSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const bootstrapPath = path.join(repositoryRoot, "scripts/bootstrap-local-playwright.sh");
const syncPath = path.join(repositoryRoot, "scripts/sync-local-main.sh");

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
