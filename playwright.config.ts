import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  timeout: 30000,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:39799", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node src/cli/bin.ts tests/.tmp/northfield --port 39799 --no-open --home tests/.tmp/home",
    url: "http://127.0.0.1:39799/",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
