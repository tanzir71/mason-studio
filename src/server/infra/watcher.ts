import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { statSync } from "node:fs";
import { join } from "node:path";
import type { MasonEvent } from "../../contracts/model.ts";
import type { CreateProjectWatcher, EventHub, EventSink } from "../../contracts/ports.ts";

export const DEBOUNCE_MS = 150;
const IGNORED = /(^|\/)(\.git|node_modules)(\/|$)/;

/**
 * fs.watch(root, { recursive: true }); file names ("\\" → "/") outside .git/ and node_modules/ are collected and
 * emitted as one { type: "external-change", files } (sorted, unique) 150 ms after the last change. watch() replaces
 * the previous watch; close() stops it and drops pending changes.
 */
export const createProjectWatcher: CreateProjectWatcher = (events: EventSink) => {
  let watcher: FSWatcher | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = new Set<string>();
  const stop = () => {
    watcher?.close();
    watcher = null;
    if (timer) clearTimeout(timer);
    timer = null;
    pending = new Set();
  };
  return {
    watch(root: string) {
      stop();
      watcher = watch(root, { recursive: true }, (_event, name) => {
        if (!name) return;
        const file = String(name).replace(/\\/g, "/");
        if (IGNORED.test(file)) return;
        try { if (statSync(join(root, file)).isDirectory()) return; } catch { /* gone already: keep it */ }
        pending.add(file);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          const files = [...pending].sort();
          pending = new Set();
          timer = null;
          events.emit({ type: "external-change", files });
        }, DEBOUNCE_MS);
      });
      watcher.on("error", () => stop());
    },
    close: stop,
  };
};

/**
 * An EventSink in front of `hub` that drops external-change files Mason itself wrote (a "written" event within
 * `windowMs`), so Mason's own saves do not reload the boards twice. Other events pass through unchanged.
 */
export function suppressOwnWrites(hub: EventHub, windowMs = 1000, now: () => number = Date.now): EventSink {
  const written = new Map<string, number>();
  hub.subscribe((e: MasonEvent) => {
    if (e.type === "written") for (const f of e.files) written.set(f, now());
  });
  return {
    emit(e: MasonEvent) {
      if (e.type !== "external-change") { hub.emit(e); return; }
      const files = e.files.filter((f) => { const t = written.get(f); return t === undefined || now() - t > windowMs; });
      if (files.length > 0) hub.emit({ type: "external-change", files });
    },
  };
}
