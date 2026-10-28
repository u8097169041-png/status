import { expect, test } from '@playwright/test';

/**
 * KI-Pfad über die Oberfläche: Schlüssel, Modellwahl, Verbindungstest, KI-Chat und Verbrauch.
 * Die App spricht dabei mit einem lokalen OpenRouter-Nachbau (e2e/mock-openrouter.mjs).
 */
test.describe.serial('SocialVerse – KI-Anbindung (simulierter Anbieter)', () => {
  test.beforeAll(async ({ request }) => {
    const headers = { 'X-SocialVerse': '1' };
    await request.patch('/api/settings', { headers, data: { onboardingDone: true } });
    // Chats gibt es nur innerhalb einer Welt: Pip und Ines Valdés (beide Aurelia) brauchen eine Spielfigur dort.
    const pip = await (await request.get('/api/characters/c-pip')).json();
    await request.post(`/api/worlds/${pip.character.worldId}/join`, {
      headers,
      data: { mode: 'custom', character: { name: 'KI-Testerin' } },
    });
  });

  test.afterAll(async ({ request }) => {
    // Ausgangszustand für die übrigen Tests wiederherstellen.
    await request.post('/api/data/reset', { headers: { 'X-SocialVerse': '1' }, data: { confirm: 'RESET', language: 'de' } });
  });

  test('Schlüssel speichern, Modell wählen, Verbindung testen und mit KI chatten', async ({ page }) => {
    await page.goto('/settings#ai');
    await page.getByLabel('OpenRouter-API-Schlüssel').fill('sk-or-v1-falscher-schluessel-000');
    await page.getByRole('button', { name: 'Schlüssel speichern' }).click();
    await page.getByRole('button', { name: 'Verbindung testen' }).click();
    await expect(page.getByText(/Test fehlgeschlagen: Schlüssel ungültig/)).toBeVisible();

    await page.getByRole('button', { name: 'Schlüssel entfernen' }).click();
    await page.getByLabel('OpenRouter-API-Schlüssel').fill('sk-or-v1-e2e-mock-key-0123456789');
    await page.getByRole('button', { name: 'Schlüssel speichern' }).click();
    await page.getByRole('button', { name: 'Verbindung testen' }).click();
    await expect(page.getByText('Schlüssel ist gültig. Wähle noch ein Chat-Modell.')).toBeVisible();

    await page.getByRole('button', { name: 'Modell wählen: Chat-Modell' }).click();
    const picker = page.getByRole('dialog', { name: 'Chat-Modell' });
    await expect(picker.getByText('Mock Free Chat')).toBeVisible();
    await expect(picker.getByText('Mock Paid Chat')).toBeHidden();
    await picker.getByRole('button', { name: 'Nur kostenlose' }).click();
    await expect(picker.getByText('Mock Paid Chat')).toBeVisible();
    await picker.getByRole('button', { name: /Mock Free Chat/ }).click();
    await expect(page.locator('.model-id').first()).toHaveText('mock/free-chat');

    await page.getByRole('button', { name: 'Verbindung testen' }).click();
    await expect(page.getByText(/Verbindung erfolgreich: mock\/free-chat/)).toBeVisible();
    await expect(page.locator('.sidebar-mode')).toContainText('KI aktiv');

    await page.goto('/chats/c-pip');
    const input = page.getByLabel('Nachricht an Pip Navarro …');
    await input.fill('Wie geht es der Station?');
    await input.press('Enter');
    await expect(page.locator('.message.assistant .bubble')).toContainText('KI-Antwort (mock/free-chat)');
    await expect(page.getByText('KI · mock/free-chat')).toBeVisible();

    await page.getByRole('button', { name: 'Was wird gesendet?' }).click();
    const preview = page.getByRole('dialog', { name: 'Inhalt der nächsten KI-Anfrage' });
    await expect(preview.getByText(/gehen bei deiner nächsten Nachricht an OpenRouter/)).toBeVisible();
    await expect(preview.locator('pre').first()).toContainText('Pip Navarro');
    await preview.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/settings#ai');
    await page.getByRole('button', { name: 'Protokoll der letzten Anfragen' }).click();
    await expect(page.locator('.usage-table tbody tr').filter({ hasText: 'chat' }).first()).toBeVisible();
  });

  test('Budget 0 blockiert kostenpflichtige Modelle mit verständlichem Hinweis', async ({ page, request }) => {
    await request.patch('/api/settings', {
      headers: { 'X-SocialVerse': '1' },
      data: { ai: { chatModel: 'mock/paid-chat', dailyBudgetUsd: 0 } },
    });
    await page.goto('/chats/c-valdes');
    const input = page.getByLabel('Nachricht an Ines Valdés …');
    await input.fill('Statusbericht?');
    await input.press('Enter');
    await expect(page.getByText(/KI nicht verfügbar \(eigenes Limit erreicht\)/)).toBeVisible();
    await expect(page.getByText('Demo-Antwort · lokal erzeugt, keine KI')).toBeVisible();
  });
});
