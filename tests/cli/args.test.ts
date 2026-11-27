import { describe, expect, it } from "vitest";
import { parseCliArgs, HELP_TEXT } from "../../src/cli/args.ts";

describe("parseCliArgs", () => {
  it("uses defaults with no arguments", () => {
    expect(parseCliArgs([])).toEqual({ kind: "run", project: null, port: 39765, open: true, home: null });
  });
  it("reads a folder, --port, --no-open and --home in any order", () => {
    expect(parseCliArgs(["--no-open", "site", "--port", "4000", "--home", "h"])).toEqual({ kind: "run", project: "site", port: 4000, open: false, home: "h" });
  });
  it("returns help for -h and --help", () => {
    expect(parseCliArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ kind: "help" });
    expect(HELP_TEXT.startsWith("Usage: mason [folder]")).toBe(true);
  });
  it("rejects a bad port and unknown flags", () => {
    expect(parseCliArgs(["--port", "x"])).toEqual({ kind: "error", message: "--port needs a number from 0 to 65535" });
    expect(parseCliArgs(["--wat"])).toEqual({ kind: "error", message: "Unknown option: --wat" });
  });
  it("rejects a second folder", () => {
    expect(parseCliArgs(["a", "b"])).toEqual({ kind: "error", message: "Only one folder can be opened" });
  });
});
