import { MasonError } from "../../contracts/errors.ts";
import type { ProjectInfo, Proposal } from "../../contracts/model.ts";
import type { FileSystem, StudioDeps } from "../../contracts/ports.ts";

/** One undo step: every file it touched, with its text before (null = file did not exist) and after. */
export interface HistoryStep { files: { path: string; before: string | null; after: string }[]; message: string }

/** Mutable state shared by every studio group. Created once per createStudio call. */
export interface EngineContext {
  deps: StudioDeps;
  project: ProjectInfo | null;
  fs: FileSystem | null;
  undoStack: HistoryStep[];
  redoStack: HistoryStep[];
  revision: number;
  proposals: Proposal[]; // newest first
}

export function createEngineContext(deps: StudioDeps): EngineContext {
  return { deps, project: null, fs: null, undoStack: [], redoStack: [], revision: 0, proposals: [] };
}

/** The open project's file system, or NO_PROJECT. */
export function requireFs(ctx: EngineContext): FileSystem {
  if (!ctx.fs || !ctx.project) throw new MasonError("NO_PROJECT");
  return ctx.fs;
}

/** The open project, or NO_PROJECT. */
export function requireProject(ctx: EngineContext): ProjectInfo {
  if (!ctx.fs || !ctx.project) throw new MasonError("NO_PROJECT");
  return ctx.project;
}
