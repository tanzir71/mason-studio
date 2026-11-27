import { MasonError } from "../../contracts/errors.ts";
import type { CreateEventHub } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createEventHub: CreateEventHub = () => {
  throw new MasonError("NOT_IMPLEMENTED", "createEventHub");
};
