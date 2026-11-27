import { MasonError } from "../../contracts/errors.ts";
import type { CreateNodeFileSystem } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createNodeFileSystem: CreateNodeFileSystem = (_root) => {
  throw new MasonError("NOT_IMPLEMENTED", "createNodeFileSystem");
};
