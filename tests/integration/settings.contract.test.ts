import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSettingsStoreContract } from "../../src/contracts/settings-store.contract.ts";
import { createFileSettingsStore } from "../../src/server/infra/settings.ts";

runSettingsStoreContract("file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mason-settings-"));
  return { store: createFileSettingsStore(join(dir, "settings.json")), cleanup: async () => rmSync(dir, { recursive: true, force: true }) };
});
