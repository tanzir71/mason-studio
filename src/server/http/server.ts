import { MasonError } from "../../contracts/errors.ts";
import type { CreateHttpServer } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createHttpServer: CreateHttpServer = (_options) => {
  throw new MasonError("NOT_IMPLEMENTED", "createHttpServer");
};
