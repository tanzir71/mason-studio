import { MasonError } from "../../contracts/errors.ts";
import type { CreateNodeGitRunner } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createNodeGitRunner: CreateNodeGitRunner = (_root) => {
  throw new MasonError("NOT_IMPLEMENTED", "createNodeGitRunner");
};
