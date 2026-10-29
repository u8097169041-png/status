import { defineConfig, devices } from '@playwright/test';

const PORT = 3199;
const MOCK_PORT = 3198;
/** Zweite App-Instanz für die KI-Tests: lokale KI (Ollama-Nachbau) und konfigurierte Server-KI (OpenRouter-Nachbau). */
const AI_PORT = 3197;
const OLLAMA_PORT = 3196;

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
      command: `node e2e/mock-ollama.mjs ${OLLAMA_PORT}`,
      port: OLLAMA_PORT,
      reuseExistingServer: false,
      // Langsame Token-Ausgabe, damit Fortschrittsanzeige und Abbruch beim Weltentwurf testbar sind.
      env: { MOCK_OLLAMA_TOKEN_DELAY_MS: '40' },
    },
    {
      // Startet den Produktionsbuild mit einer frischen, temporären Datenbank (ohne echte KI).
      command: `node scripts/e2e-server.mjs ${PORT}`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node scripts/e2e-server.mjs ${AI_PORT}`,
      url: `http://127.0.0.1:${AI_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        LOCAL_AI_ENABLED: 'true',
        LOCAL_AI_BASE_URL: `http://127.0.0.1:${OLLAMA_PORT}`,
        SERVER_AI_ENABLED: 'true',
        SERVER_AI_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/api/v1`,
        SERVER_AI_API_KEY: 'sk-or-v1-e2e-mock-key-0123456789',
        SERVER_AI_MODEL: 'mock/free-chat',
      },
    },
  ],
});
