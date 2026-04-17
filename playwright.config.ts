import { defineConfig, devices } from '@playwright/test';

// Retrace expects three services: Fastify (3000), Vite dev (5173), llama-server (8080).
// Playwright auto-starts Fastify + Vite; llama-server must be started manually
// (scripts/llama-start.bat) since it requires a local model file.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm -w server run dev',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm -w client run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
