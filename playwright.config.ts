import { defineConfig, devices } from '@playwright/test';

const PORT = 3199;
const MOCK_PORT = 3198;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } }],
  webServer: [
    {
      // Lokaler OpenRouter-Nachbau für den KI-Pfad (keine echten Anfragen nach außen).
      command: `node e2e/mock-openrouter.mjs ${MOCK_PORT}`,
      port: MOCK_PORT,
      reuseExistingServer: false,
    },
    {
      // Startet den Produktionsbuild mit einer frischen, temporären Datenbank.
      command: `node scripts/e2e-server.mjs ${PORT}`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { OPENROUTER_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/api/v1` },
    },
  ],
});
