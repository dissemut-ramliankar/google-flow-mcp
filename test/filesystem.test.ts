import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { existingFileWithinRoot, newFileWithinRoot } from "../src/filesystem.js";

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "google-flow-mcp-filesystem-"));
  const root = path.join(directory, "assets");
  const outside = path.join(directory, "outside");
  await Promise.all([mkdir(root), mkdir(outside)]);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { root, outside };
}

test("existing media rejects traversal and symlink escapes", async (t) => {
  const { root, outside } = await fixture(t);
  const outsideFile = path.join(outside, "source.mp4");
  await writeFile(outsideFile, "outside");
  await symlink(outside, path.join(root, "linked"));

  await assert.rejects(() => existingFileWithinRoot(root, outsideFile, "Upload file"), /outside the allowed root/);
  await assert.rejects(() => existingFileWithinRoot(root, path.join(root, "linked", "source.mp4"), "Media file"), /escapes the allowed root/);
});

test("existing media rejects non-regular files", async (t) => {
  const { root } = await fixture(t);
  const directory = path.join(root, "not-a-file");
  await mkdir(directory);

  await assert.rejects(() => existingFileWithinRoot(root, directory, "Upload file"), /regular file/);
});

test("download destination rejects traversal, symlink escapes, and existing files", async (t) => {
  const { root, outside } = await fixture(t);
  await symlink(outside, path.join(root, "linked"));
  const existing = path.join(root, "existing.mp4");
  await writeFile(existing, "existing");

  await assert.rejects(() => newFileWithinRoot(root, outside, "escape.mp4", "Download"), /outside the allowed root/);
  await assert.rejects(() => newFileWithinRoot(root, path.join(root, "linked", "nested"), "escape.mp4", "Download"), /escapes the allowed root/);
  assert.deepEqual(await readdir(outside), []);
  await assert.rejects(() => newFileWithinRoot(root, root, "existing.mp4", "Download"), /already exists/);
});
