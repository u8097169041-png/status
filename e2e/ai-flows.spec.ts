import { expect, test } from '@playwright/test';

/**
 * Hybrid-KI über die Oberfläche: lokale KI (Ollama-Nachbau), Server-KI nur nach Freigabe (OpenRouter-Nachbau)
 * und simulierte KI. Läuft gegen eine eigene App-Instanz (Port 3197), damit die übrigen Tests ohne KI bleiben.
 */
test.use({ baseURL: 'http://127.0.0.1:3197' });

test.describe.serial('SocialVerse – Hybrid-KI (simulierte Anbieter)', () => {
  test.beforeAll(async ({ request }) => {
    const headers = { 'X-SocialVerse': '1' };
    await request.patch('/api/settings', { headers, data: { onboardingDone: true } });
    // Chats gibt es nur innerhalb einer Welt: Pip (Aurelia) braucht eine Spielfigur dort.
    const pip = await (await request.get('/api/characters/c-pip')).json();
    await request.post(`/api/worlds/${pip.character.worldId}/join`, {
      headers,
      data: { mode: 'custom', character: { name: 'KI-Testerin' } },
    });
  });

  test('Lokale KI wird automatisch erkannt und beantwortet Chats kostenlos', async ({ page }) => {
    await page.goto('/settings#ai');
    const section = page.locator('section#ai');
    await expect(section.locator('.diag-row').filter({ hasText: 'Lokale KI (Ollama)' })).toContainText('erreichbar (Version 0.9.0-mock)');
    await expect(section.locator('.diag-row').filter({ hasText: 'Aktuell antwortet' })).toContainText('Lokale KI · gemma3:4b');
    // Einbettungsmodelle werden nicht zur Auswahl angeboten.
    const select = section.getByLabel('Lokales Modell');
    await expect(select.locator('option')).toHaveCount(2);
    await section.getByRole('button', { name: 'Lokale KI testen' }).click();
    await expect(section.getByText(/Lokale KI: gemma3:4b antwortete in \d+ ms/)).toBeVisible();
    await expect(page.getByLabel(/Schlüssel|API key/i)).toHaveCount(0);

    await page.goto('/chats/c-pip');
    const input = page.getByLabel('Nachricht an Pip Navarro …');
    await input.fill('Wie geht es der Station?');
    await input.press('Enter');
    await expect(page.locator('.message.assistant .bubble')).toContainText('Lokale KI-Antwort: Du schreibst');
    await expect(page.getByText('Lokale KI · gemma3:4b')).toBeVisible();
    await page.getByRole('button', { name: 'Was wird gesendet?' }).click();
    const preview = page.getByRole('dialog', { name: 'Inhalt der nächsten KI-Anfrage' });
    await expect(preview.getByText(/lokale KI \(gemma3:4b\) – sie verlassen diesen Computer nicht/)).toBeVisible();
    await expect(preview.locator('pre').first()).toContainText('Game context (read-only)');
    await preview.getByRole('button', { name: 'Schließen' }).click();
  });

  test('Weltentwurf mit lokaler KI: Fortschritt, Abbruch und Ergebnis', async ({ page }) => {
    await page.goto('/worlds/new');
    await page.getByRole('radio', { name: 'Mystery' }).click();
    await page.getByRole('button', { name: 'Entwurf erzeugen' }).click();
    const progress = page.locator('.generation-progress');
    await expect(progress).toContainText('Lokale KI schreibt den Entwurf');
    await expect(progress).toContainText('gemma3:4b');
    // Abbrechen liefert sofort den lokalen Entwurf.
    await progress.getByRole('button', { name: 'Abbrechen und lokalen Entwurf verwenden' }).click();
    await expect(page.getByText('Abgebrochen – es wird der lokale Entwurf verwendet.')).toBeVisible();
    await expect(page.locator('.draft-section .badge')).toHaveText('Lokaler Entwurf');

    // Zweiter Versuch läuft bis zum Ende durch.
    await page.getByRole('button', { name: 'Neu würfeln' }).click();
    await expect(progress).toBeVisible();
    await expect(page.locator('.draft-section .badge')).toHaveText('KI-Entwurf', { timeout: 30_000 });
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('KI-Welt Nebelbucht');
    await expect(progress).toHaveCount(0);
  });

  test('Server-KI wird erst nach ausdrücklicher Freigabe genutzt', async ({ page }) => {
    await page.goto('/settings#ai');
    const section = page.locator('section#ai');
    await section.getByRole('radio', { name: /Server-KI/ }).click();
    // Ohne Freigabe springt die kostenlose lokale KI ein.
    await expect(section.locator('.diag-row').filter({ hasText: 'Aktuell antwortet' })).toContainText('Lokale KI');
    await expect(section.locator('.diag-row').filter({ hasText: 'Aktuell antwortet' })).toContainText('nicht freigegeben');
    await section.getByRole('switch', { name: 'Server-KI erlauben' }).click();
    await expect(section.locator('.diag-row').filter({ hasText: 'Aktuell antwortet' })).toContainText('Server-KI · mock/free-chat');

    await page.goto('/chats/c-pip');
    const input = page.getByLabel('Nachricht an Pip Navarro …');
    await input.fill('Und jetzt über den Server?');
    await input.press('Enter');
    await expect(page.getByText('Server-KI · mock/free-chat')).toBeVisible();

    await page.goto('/settings#ai');
    await page.getByRole('button', { name: 'Protokoll der letzten Anfragen' }).click();
    const rows = page.locator('.usage-table tbody tr');
    await expect(rows.filter({ hasText: 'Server-KI' }).first()).toBeVisible();
    await expect(rows.filter({ hasText: 'Lokale KI' }).first()).toBeVisible();
  });

  test('Modus „Nur simulierte KI“ antwortet regelbasiert', async ({ page }) => {
    await page.goto('/settings#ai');
    const section = page.locator('section#ai');
    await section.getByRole('radio', { name: /Nur simulierte KI/ }).click();
    await expect(section.locator('.diag-row').filter({ hasText: 'Aktuell antwortet' })).toContainText('Simulierte KI');
    await page.goto('/chats/c-pip');
    const input = page.getByLabel('Nachricht an Pip Navarro …');
    await input.fill('Bist du noch da?');
    await input.press('Enter');
    await expect(page.getByText('Simulierte Antwort · regelbasiert, keine KI').last()).toBeVisible();
  });
});
