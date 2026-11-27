#!/usr/bin/env node
import { resolve } from "node:path";
import { parseCliArgs, HELP_TEXT } from "./args.ts";
import { openBrowser } from "./open-browser.ts";
import { startMason } from "../server/start.ts";

const args = parseCliArgs(process.argv.slice(2));
if (args.kind === "help") { process.stdout.write(HELP_TEXT); process.exit(0); }
if (args.kind === "error") { process.stderr.write(`${args.message}\n`); process.exit(2); }
if (args.kind === "run") {
  try {
    const running = await startMason({ port: args.port, project: args.project ? resolve(args.project) : null, homeDir: args.home ? resolve(args.home) : null, uiDir: null });
    console.log(`Mason is running at ${running.url}`);
    if (args.open) openBrowser(running.url);
    const stop = async () => { await running.close(); process.exit(0); };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
