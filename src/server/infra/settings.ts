import { MasonError } from "../../contracts/errors.ts";
import type { CreateFileSettingsStore } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createFileSettingsStore: CreateFileSettingsStore = (_filePath) => {
  throw new MasonError("NOT_IMPLEMENTED", "createFileSettingsStore");
};
