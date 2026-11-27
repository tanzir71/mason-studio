import { MasonError } from "../../contracts/errors.ts";
import { STUDIO_METHODS } from "../../contracts/ports.ts";
import type { CreateStudio, StudioDeps, StudioService } from "../../contracts/ports.ts";
import { createEngineContext } from "./context.ts";
import { createProjectGroup } from "./project-group.ts";
import { createPageGroup } from "./page-group.ts";
// @seam:imports

/** Every method rejects NOT_IMPLEMENTED until its group is assigned above `@seam:groups`. */
export const createStudio: CreateStudio = (deps: StudioDeps): StudioService => {
  const ctx = createEngineContext(deps);
  const studio: Record<string, unknown> = {};
  for (const m of STUDIO_METHODS) studio[m] = async () => { throw new MasonError("NOT_IMPLEMENTED", m); };
  Object.assign(studio, createProjectGroup(ctx));
  Object.assign(studio, createPageGroup(ctx));
  // @seam:groups
  return studio as unknown as StudioService;
};
