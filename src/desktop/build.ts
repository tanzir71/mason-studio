import { build } from "esbuild";

/**
 * Bundles the Electron entry points into dist/desktop:
 * - main.mjs (ESM; npm packages stay external and load from node_modules; start.ts's REPO_ROOT still resolves two folders up)
 * - preload.cjs (CommonJS, required for sandboxed preloads; only `electron` is external)
 */
await build({
  entryPoints: ["src/desktop/main.ts"], outfile: "dist/desktop/main.mjs", bundle: true, platform: "node",
  format: "esm", target: "node22", packages: "external", sourcemap: true, logLevel: "warning",
});
await build({
  entryPoints: ["src/desktop/preload.ts"], outfile: "dist/desktop/preload.cjs", bundle: true, platform: "node",
  format: "cjs", target: "node22", external: ["electron"], logLevel: "warning",
});
console.log("built dist/desktop");
