import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_SETTINGS } from "../../contracts/model.ts";
import type { StoredSettings } from "../../contracts/model.ts";
import type { CreateFileSettingsStore } from "../../contracts/ports.ts";

export const createFileSettingsStore: CreateFileSettingsStore = (filePath) => ({
  async load(): Promise<StoredSettings> {
    let parsed: Partial<StoredSettings> | null = null;
    try {
      const value = JSON.parse(await readFile(filePath, "utf8")) as Partial<StoredSettings> | null;
      parsed = value && typeof value === "object" ? value : null;
    } catch {
      parsed = null;
    }
    if (!parsed) return { settings: structuredClone(DEFAULT_SETTINGS), recent: [] };
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...parsed.settings,
        agent: { ...DEFAULT_SETTINGS.agent, ...parsed.settings?.agent },
      },
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
    };
  },
  async save(value): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  },
});
