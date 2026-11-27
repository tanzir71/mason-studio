import { MasonError } from "../../contracts/errors.ts";
import type { CreateMcpHandler } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createMcpHandler: CreateMcpHandler = (_studio, _options) => {
  throw new MasonError("NOT_IMPLEMENTED", "createMcpHandler");
};
