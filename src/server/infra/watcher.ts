import { MasonError } from "../../contracts/errors.ts";
import type { CreateProjectWatcher } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createProjectWatcher: CreateProjectWatcher = (_events) => {
  throw new MasonError("NOT_IMPLEMENTED", "createProjectWatcher");
};
