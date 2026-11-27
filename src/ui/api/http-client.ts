import { MasonError } from "../../contracts/errors.ts";
import type { CreateHttpClient } from "../../contracts/ui.tsx";

/** Stub: implemented by a later card. */
export const createHttpClient: CreateHttpClient = (_baseUrl) => {
  throw new MasonError("NOT_IMPLEMENTED", "createHttpClient");
};
