import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/.tmp/**", "node_modules/**"],
    environment: "node",
    setupFiles: ["tests/setup-dom.ts"],
    testTimeout: 20000,
  },
});
