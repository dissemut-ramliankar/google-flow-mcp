import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

test("stdio client discovers the expected MCP tools with an isolated runtime environment", async (t) => {
  const tmpRoot = path.resolve(".evaluation/tmp");
  await mkdir(tmpRoot, { recursive: true });
  const dataDir = await mkdtemp(path.join(tmpRoot, "stdio-data-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const env = { ...process.env };
  delete env.FLOW_PROFILE_DIR;
  delete env.FLOW_STATE_FILE;
  delete env.FLOW_DATABASE_FILE;
  delete env.FLOW_ASSET_DIR;
  delete env.FLOW_DOWNLOAD_DIR;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("dist/src/index.js")],
    cwd: process.cwd(),
    stderr: "pipe",
    env: {
      ...env,
      FLOW_BROWSER_EXECUTABLE: process.env.FLOW_BROWSER_EXECUTABLE ?? "/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
      FLOW_DATA_DIR: dataDir,
      TMPDIR: tmpRoot,
    },
  });
  const client = new Client({ name: "google-flow-mcp-smoke", version: "0.1.0" });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = new Set(tools.map((tool) => tool.name));
    for (const expected of [
      "project_create",
      "flow_start_login",
      "flow_confirm_login",
      "flow_inspect_page",
      "flow_download_asset",
      "flow_download_media",
      "flow_bind_asset",
      "flow_open_project",
      "flow_open_media",
      "flow_prepare_generation",
      "flow_submit_generation",
      "flow_wait_for_generation",
      "mcp_health_check",
      "media_validate_local",
      "state_backup",
    ]) {
      assert.ok(names.has(expected), `missing tool: ${expected}`);
    }
    assert.equal(tools.length, 22);
  } finally {
    await client.close();
  }
});
