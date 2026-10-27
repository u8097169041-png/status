import { expect, test, type Page } from '@playwright/test';

/**
 * Zentrale Benutzerabläufe gegen den Produktionsbuild (frische Datenbank, Demo-Modus).
 * Die Tests laufen nacheinander und bauen aufeinander auf.
 */
test.describe.serial('SocialVerse – Kernabläufe', () => {
  let page: Page;
  const consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
  });

  test.afterAll(async () => {
    expect(consoleErrors, 'Keine JavaScript-Fehler in der Konsole').toEqual([]);
    await page.close();
  });

  test('Onboarding: Sprache, Name und Start', async () => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Willkommen bei SocialVerse' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: 'Deutsch' }).click();
    await dialog.getByRole('button', { name: 'Weiter' }).click();
    await dialog.getByLabel('Wie sollen dich die Charaktere nennen?').fill('Testerin');
    await dialog.getByRole('button', { name: 'Weiter' }).click();
    await expect(dialog.getByText('So funktioniert die KI')).toBeVisible();
    await dialog.getByRole('button', { name: 'Los geht’s' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Entdecken', level: 1 })).toBeVisible();
    await expect(page.locator('.sidebar-profile')).toContainText('Testerin');
  });

  test('Navigation zu allen Hauptbereichen', async () => {
    const nav = page.getByRole('complementary', { name: 'Hauptnavigation' });
    for (const [label, heading] of [
      ['Feed', 'Feed'],
      ['Welten', 'Welten'],
      ['Chats', 'Chats'],
      ['Charaktere', 'Charaktere'],
      ['Fortschritt', 'Fortschritt'],
      ['Einstellungen', 'Einstellungen'],
      ['Entdecken', 'Entdecken'],
    ]) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    }
  });

  test('Beitrag erstellen, liken, merken, kommentieren und bearbeiten', async () => {
    await page.goto('/feed');
    await page.getByLabel('Was passiert gerade?').fill('Mein erster Testbeitrag #e2etest');
    await page.getByRole('button', { name: 'Posten' }).click();
    const post = page.locator('article.post-card').filter({ hasText: 'Mein erster Testbeitrag' });
    await expect(post).toBeVisible();
    await expect(page.getByText('+15 XP').first()).toBeVisible();

    const like = post.getByRole('button', { name: /Gefällt mir/ });
    await like.click();
    await expect(post.getByRole('button', { name: /Gefällt mir nicht mehr \(1\)/ })).toBeVisible();
    await post.getByRole('button', { name: /Gefällt mir nicht mehr/ }).click();
    await expect(post.getByRole('button', { name: /^Gefällt mir \(0\)/ })).toBeVisible();

    await post.getByRole('button', { name: 'Merken' }).click();
    await expect(post.getByRole('button', { name: 'Lesezeichen entfernen' })).toBeVisible();

    await post.getByRole('button', { name: 'Optionen' }).click();
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click();
    await post.getByLabel('Bearbeiten').fill('Mein erster Testbeitrag (bearbeitet) #e2etest');
    await post.getByRole('button', { name: 'Speichern' }).click();
    await expect(post).toContainText('(bearbeitet)');

    await post.getByRole('link', { name: /Kommentare/ }).click();
    await expect(page.getByRole('heading', { name: 'Beitrag' })).toBeAttached();
    await page.getByLabel('Kommentar schreiben …').fill('Ein Kommentar aus dem Test');
    await page.getByRole('button', { name: 'Senden' }).click();
    await expect(page.locator('.comment').filter({ hasText: 'Ein Kommentar aus dem Test' })).toBeVisible();

    await page.goto('/profile');
    await page.getByRole('tab', { name: 'Lesezeichen' }).click();
    await expect(page.getByText('Mein erster Testbeitrag (bearbeitet)')).toBeVisible();
  });

  test('Story erstellen und fremde Stories ansehen', async () => {
    await page.goto('/feed');
    await page.locator('.story-ring.add').click();
    const dialog = page.getByRole('dialog', { name: 'Story erstellen' });
    await dialog.getByLabel('Was möchtest du für 24 Stunden teilen?').fill('Story aus dem Test');
    await dialog.getByRole('button', { name: 'Veröffentlichen' }).click();
    await expect(page.getByText('Story veröffentlicht')).toBeVisible();
    await page.getByRole('button', { name: 'Story von KITO-7' }).click();
    const viewer = page.getByRole('dialog', { name: 'Story von KITO-7' });
    await expect(viewer).toBeVisible();
    await page.waitForTimeout(500);
    await expect(viewer.locator('.story-head')).toContainText('KITO-7');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Deine Story' }).click();
    await expect(page.locator('.story-text')).toHaveText('Story aus dem Test');
    await page.keyboard.press('Escape');
  });

  test('Feed nach Thema filtern', async () => {
    await page.goto('/feed?tag=e2etest');
    await expect(page.locator('article.post-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await expect(page.locator('article.post-card').nth(3)).toBeVisible();
  });

  test('Chat im Demo-Modus mit Erinnerung', async () => {
    await page.goto('/chats/c-mira');
    const input = page.getByLabel('Nachricht an Mira Vex …');
    await input.fill('Hallo Mira! Ich heiße Testerin und ich mag Regen.');
    await input.press('Enter');
    await expect(page.locator('.message.assistant')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.getByText('Demo-Antwort · lokal erzeugt, keine KI')).toBeVisible();
    await page.getByRole('button', { name: 'Erinnerung' }).click();
    const memory = page.getByRole('dialog', { name: 'Gesprächserinnerung' });
    await expect(memory.getByText('Name: Testerin')).toBeVisible();
    await expect(memory.getByText('Mag Regen')).toBeVisible();
    await memory.getByRole('button', { name: 'Schließen' }).click();
    await page.getByRole('button', { name: 'Was wird gesendet?' }).click();
    const preview = page.getByRole('dialog', { name: 'Inhalt der nächsten KI-Anfrage' });
    await expect(preview.getByText('Im Demo-Modus wird nichts gesendet', { exact: false })).toBeVisible();
    await expect(preview.locator('pre').first()).toContainText('Mira Vex');
    await preview.getByRole('button', { name: 'Schließen' }).click();
    await page.goto('/chats');
    await expect(page.locator('.chat-row').filter({ hasText: 'Mira Vex' })).toBeVisible();
  });

  test('Welt: Zeit vergehen lassen und Ereignis auslösen', async () => {
    await page.goto('/worlds/w-brass');
    await expect(page.getByRole('heading', { name: 'Messinghafen', level: 1 })).toBeVisible();
    const dayBadge = page.locator('.world-hero .badge').filter({ hasText: /^Tag \d+$/ });
    const before = Number((await dayBadge.textContent())?.replace(/\D/g, ''));
    await page.getByRole('button', { name: 'Zeit vergehen lassen' }).click();
    await expect(dayBadge).toHaveText(`Tag ${before + 1}`);
    await expect(page.getByRole('tab', { name: 'Ereignisse' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.event-item').first()).toBeVisible();

    await page.getByRole('button', { name: 'Ereignis auslösen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ereignis auslösen' });
    await dialog.getByRole('radio', { name: /Gerücht streuen/ }).click();
    await dialog.getByRole('button', { name: /Theodora/ }).click();
    await dialog.getByRole('button', { name: /Wren Castellane/ }).click();
    await dialog.getByRole('button', { name: 'Auslösen' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.event-item').filter({ hasText: 'Gerüchteküche' }).first()).toBeVisible();

    await page.getByRole('tab', { name: /Beziehungen/ }).click();
    await expect(page.getByRole('img', { name: 'Beziehungsnetz' })).toBeVisible();
    await page.getByRole('button', { name: /Beziehung bearbeiten: Lord Percival Ashgrove & Theodora/ }).click();
    const relDialog = page.getByRole('dialog', { name: 'Beziehung bearbeiten' });
    await relDialog.getByLabel('Art').selectOption('ally');
    await relDialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Beziehung aktualisiert')).toBeVisible();
    await expect(page.locator('.relationship-row').filter({ hasText: 'Lord Percival Ashgrove & Theodora' })).toContainText('Bündnis');

    await page.getByRole('tab', { name: 'Überblick' }).click();
    await page.getByRole('button', { name: 'Geschichte beginnen' }).click();
    const storyDialog = page.getByRole('dialog', { name: 'Geschichte beginnen' });
    await storyDialog.getByLabel('Titel').fill('Der verschwundene Zeppelin');
    const stageInput = storyDialog.getByPlaceholder('Nächstes Kapitel …');
    await stageInput.fill('Ein Zeppelin verschwindet');
    await stageInput.press('Enter');
    await stageInput.fill('Die Spur führt zum Uhrturm');
    await stageInput.press('Enter');
    await storyDialog.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.locator('.storyline').filter({ hasText: 'Der verschwundene Zeppelin' })).toBeVisible();
  });

  test('Eigenen Charakter erstellen', async () => {
    await page.goto('/characters/new');
    await page.getByLabel('Name', { exact: true }).fill('Testa Probe');
    await page.getByLabel('Handle').fill('testa_probe');
    await page.getByLabel('Kurzvorstellung').fill('Ich teste alles.');
    await page.getByLabel('Welt').selectOption({ label: 'Neonhafen' });
    await page.getByLabel('Charakterzüge').fill('gründlich');
    await page.getByLabel('Charakterzüge').press('Enter');
    await page.getByRole('switch', { name: 'An eine reale Person angelehnt' }).click();
    await page.getByRole('button', { name: 'Charakter erstellen' }).last().click();
    await expect(page.getByRole('heading', { name: 'Testa Probe', level: 1 })).toBeVisible();
    await expect(page.getByText('Fiktive KI-Simulation').first()).toBeVisible();
  });

  test('Eigene Welt mit dem Generator erschaffen', async () => {
    await page.goto('/worlds/new');
    await page.getByRole('radio', { name: 'Mystery' }).click();
    await page.getByLabel('Deine Idee').fill('Ein Leuchtturm, der Geheimnisse sammelt');
    await page.getByRole('button', { name: 'Entwurf erzeugen' }).click();
    await expect(page.getByText('Lokaler Entwurf')).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill('Testbucht');
    await page.getByRole('button', { name: 'Welt erschaffen' }).click();
    await expect(page.getByRole('heading', { name: 'Testbucht', level: 1 })).toBeVisible();
    await page.getByRole('tab', { name: /Bewohner/ }).click();
    await expect(page.locator('.character-card')).toHaveCount(3);
  });

  test('Quest einlösen erhöht die XP', async () => {
    await page.goto('/progress');
    const quest = page.locator('.quest').filter({ hasText: 'Dein erster Beitrag' });
    await quest.getByRole('button', { name: 'Einlösen' }).click();
    await expect(quest.getByText('Eingelöst')).toBeVisible();
    await expect(page.getByText('Belohnung eingelöst')).toBeVisible();
  });

  test('Sprachwechsel auf Englisch und zurück', async () => {
    await page.goto('/settings');
    await page.getByLabel('Sprache').selectOption('en');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Main navigation' }).getByRole('link', { name: 'Discover' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await page.getByLabel('Language').selectOption('de');
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
  });

  test('API-Schlüssel wird gespeichert, aber nie an den Browser gegeben', async () => {
    const secret = 'sk-or-v1-e2e-geheim-0123456789abcdef';
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) bodies.push(await response.text().catch(() => ''));
    });
    await page.goto('/settings#ai');
    await page.getByLabel('OpenRouter-API-Schlüssel').fill(secret);
    await page.getByRole('button', { name: 'Schlüssel speichern' }).click();
    await expect(page.getByText(/Lokal gespeicherter Schlüssel: sk-or-…cdef/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Lokal gespeicherter Schlüssel/)).toBeVisible();
    expect(await page.content()).not.toContain(secret);
    expect(bodies.join('\n')).not.toContain(secret);
    await page.getByRole('button', { name: 'Schlüssel entfernen' }).click();
    await expect(page.getByText('Kein Schlüssel hinterlegt', { exact: false })).toBeVisible();
  });

  test('Mobile Ansicht mit unterer Navigation', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const bottom = page.locator('nav.bottom-nav');
    await expect(bottom).toBeVisible();
    await bottom.getByRole('link', { name: 'Welten' }).click();
    await expect(page.getByRole('heading', { name: 'Welten', level: 1 })).toBeVisible();
    await bottom.getByRole('link', { name: 'Chats' }).click();
    await expect(page.getByRole('heading', { name: 'Chats', level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1360, height: 900 });
  });

  test('Alle Daten löschen setzt die App zurück', async () => {
    await page.goto('/settings#privacy');
    await page.getByLabel('Zur Bestätigung RESET eingeben').fill('RESET');
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page.getByRole('dialog', { name: 'Willkommen bei SocialVerse' })).toBeVisible();
    const res = await page.request.get('/api/posts?author=user');
    expect((await res.json()).items).toHaveLength(0);
  });
});
