import { DEFAULT_PORT } from "../contracts/http.ts";

export const HELP_TEXT = "Usage: mason [folder] [--port <number>] [--no-open] [--home <dir>]\n\nOpens Mason on http://127.0.0.1:<port>/ (default port 39765).\n";

export type CliArgs =
  | { kind: "run"; project: string | null; port: number; open: boolean; home: string | null }
  | { kind: "help" }
  | { kind: "error"; message: string };

export function parseCliArgs(argv: string[]): CliArgs {
  let project: string | null = null;
  let port = DEFAULT_PORT;
  let open = true;
  let home: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--no-open") {
      open = false;
      continue;
    }
    if (arg === "--port") {
      const value = argv[i + 1];
      i++;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 65535) return { kind: "error", message: "--port needs a number from 0 to 65535" };
      port = n;
      continue;
    }
    if (arg === "--home") {
      home = argv[i + 1] ?? null;
      i++;
      continue;
    }
    if (arg.startsWith("-")) return { kind: "error", message: `Unknown option: ${arg}` };
    if (project !== null) return { kind: "error", message: "Only one folder can be opened" };
    project = arg;
  }
  return { kind: "run", project, port, open, home };
}
