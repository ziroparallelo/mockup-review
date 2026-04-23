import { defineConfig, devices } from "@playwright/test";

const SERVER_PROJECT = "/Users/ziroparallelo/AI AGENCY/WEB SITES/studio-buccini-v3";
const SERVER_PORT = 8765;

export default defineConfig({
  testDir: "./",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${SERVER_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `cd "${SERVER_PROJECT}" && python3 .preview/mockups/_server.py`,
    port: SERVER_PORT,
    timeout: 10_000,
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
});
