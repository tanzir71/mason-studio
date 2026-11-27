import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Text files of tests/fixtures/northfield keyed by project-relative path. */
export function fixtureFiles(): Record<string, string> {
  const root = join("tests", "fixtures", "northfield");
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(root, full).replace(/\\/g, "/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return out;
}
