import { defineConfig, devices } from "@playwright/test"

// End-to-end flows against the real server, a real database and a fake
// upstream MCP server, all started by e2e/global-setup.ts. Run with
// `pnpm e2e`; it needs Docker.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The flows share one database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
