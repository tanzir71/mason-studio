import { MasonError } from "../../contracts/errors.ts";
import type { CreateHttpLlmClient } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createHttpLlmClient: CreateHttpLlmClient = (_getAgent) => {
  throw new MasonError("NOT_IMPLEMENTED", "createHttpLlmClient");
};
