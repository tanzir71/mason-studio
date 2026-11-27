import { MasonError } from "../../contracts/errors.ts";
import type { CreateStudioStore } from "../../contracts/ui.tsx";

/** Stub: implemented by a later card. */
export const createStudioStore: CreateStudioStore = (_client) => {
  throw new MasonError("NOT_IMPLEMENTED", "createStudioStore");
};
