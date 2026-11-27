import { MasonError } from "../../contracts/errors.ts";
import type { TextEdit, WriteResult } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { applyTextEdits } from "../css/edits.ts";
import { requireFs } from "./context.ts";
import type { EngineContext, HistoryStep } from "./context.ts";

export interface FileChange { path: string; after: string }
export interface CommitOptions { message?: string; path?: string | null; effective?: boolean }

function finish(ctx: EngineContext, files: string[], message: string, options: CommitOptions): WriteResult {
  ctx.revision += 1;
  const sorted = [...files].sort();
  ctx.deps.events.emit({ type: "written", files: sorted, revision: ctx.revision });
  return { files: sorted, revision: ctx.revision, effective: options.effective ?? true, path: options.path ?? null, message };
}

/**
 * Writes whole-file changes as ONE undo step: reads each file's current text (null when missing), writes `after`,
 * pushes { files, message } on undoStack, clears redoStack, revision + 1, emits written.
 * message defaults to `Saved to ${files sorted, joined ", "}`. Changes whose text is unchanged are skipped;
 * when nothing changes → MasonError("INVALID_INPUT", "Nothing changed.").
 */
export async function commitChanges(ctx: EngineContext, changes: FileChange[], options: CommitOptions = {}): Promise<WriteResult> {
  const fs = requireFs(ctx);
  const step: HistoryStep = { files: [], message: "" };
  for (const change of changes) {
    const before = (await fs.exists(change.path)) ? await fs.readText(change.path) : null;
    if (before === change.after) continue;
    step.files.push({ path: change.path, before, after: change.after });
  }
  if (step.files.length === 0) throw new MasonError("INVALID_INPUT", "Nothing changed.");
  for (const f of step.files) await fs.writeText(f.path, f.after);
  const names = step.files.map((f) => f.path).sort();
  step.message = options.message ?? `Saved to ${names.join(", ")}`;
  ctx.undoStack.push(step);
  ctx.redoStack = [];
  return finish(ctx, names, step.message, options);
}

/** Groups edits by file, applies them to the current text of each file and commits the result as one step. */
export async function writeEdits(ctx: EngineContext, edits: TextEdit[], options: CommitOptions = {}): Promise<WriteResult> {
  const fs = requireFs(ctx);
  const byFile = new Map<string, TextEdit[]>();
  for (const e of edits) byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]);
  const changes: FileChange[] = [];
  for (const [file, fileEdits] of byFile) {
    const before = (await fs.exists(file)) ? await fs.readText(file) : "";
    changes.push({ path: file, after: applyTextEdits(before, fileEdits) });
  }
  return commitChanges(ctx, changes, options);
}

/** undo/redo. A file the step created (before === null) is written back as "" (the FileSystem port cannot delete). */
export function createHistoryGroup(ctx: EngineContext): Pick<StudioService, "undo" | "redo"> {
  return {
    async undo() {
      const fs = requireFs(ctx);
      const step = ctx.undoStack.pop();
      if (!step) throw new MasonError("NOTHING_TO_UNDO");
      for (const f of step.files) await fs.writeText(f.path, f.before ?? "");
      ctx.redoStack.push(step);
      return finish(ctx, step.files.map((f) => f.path), `Undid: ${step.message}`, {});
    },
    async redo() {
      const fs = requireFs(ctx);
      const step = ctx.redoStack.pop();
      if (!step) throw new MasonError("NOTHING_TO_REDO");
      for (const f of step.files) await fs.writeText(f.path, f.after);
      ctx.undoStack.push(step);
      return finish(ctx, step.files.map((f) => f.path), `Redid: ${step.message}`, {});
    },
  };
}
