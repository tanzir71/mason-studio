import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFileSystemContract } from "../../src/contracts/file-system.contract.ts";
import { createNodeFileSystem } from "../../src/server/infra/node-fs.ts";

runFileSystemContract("node", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mason-contract-"));
  return { fs: createNodeFileSystem(dir), cleanup: async () => rmSync(dir, { recursive: true, force: true }) };
});
