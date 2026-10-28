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
      // Erwartete 409-Antworten (z. B. „noch nicht beigetreten“) protokolliert der Browser als Ladefehler.
      if (m.type() === 'error' && !m.text().includes('409')) consoleErrors.push(m.text());
    });
  });

  test.afterAll(async () => {
    expect(consoleErrors, 'Keine JavaScript-Fehler in der Konsole').toEqual([]);
    await page.close();
  });

  const sidebar = () => page.getByRole('complementary', { name: 'Hauptnavigation' });

  test('Onboarding führt zu „Entdecken“', async () => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Willkommen bei SocialVerse' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: 'Deutsch' }).click();
    await dialog.getByRole('button', { name: 'Weiter' }).click();
    await dialog.getByLabel('Dein Name im lokalen Profil').fill('Testerin');
    await dialog.getByRole('button', { name: 'Weiter' }).click();
    await expect(dialog.getByText('So funktioniert die KI')).toBeVisible();
    await dialog.getByRole('button', { name: 'Los geht’s' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/discover$/);
    await expect(page.getByRole('heading', { name: 'Entdecken', level: 1 })).toBeVisible();
    await expect(page.locator('.sidebar-profile')).toContainText('Testerin');
  });

  test('1 · Entdecken zeigt Vorschauen ohne globale Stories', async () => {
    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: 'Bekannte Figuren' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Szenarien & Geschichten' })).toBeVisible();
    await expect(page.locator('.stories-bar')).toHaveCount(0);
    await expect(page.locator('.story-ring')).toHaveCount(0);
    const categories = page.getByRole('group', { name: 'Kategorie' });
    for (const label of ['Politik', 'Promis', 'Wirtschaft', 'Sport', 'Unterhaltung', 'Szenarien', 'Fiktion']) {
      await expect(categories.getByRole('button', { name: label })).toBeVisible();
    }
    await categories.getByRole('button', { name: 'Sport' }).click();
    await expect(page.locator('.world-card')).toHaveCount(1);
    await expect(page.locator('.world-card')).toContainText('FC Hafenstadt');
    await expect(page.getByText('Alle vorgefertigten Welten und Figuren sind frei erfunden', { exact: false })).toBeVisible();

    // Ohne Beitritt: kein Feed, keine Chats
    await sidebar().getByRole('link', { name: 'Feed', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Noch in keiner Welt unterwegs' })).toBeVisible();
    await sidebar().getByRole('link', { name: 'Chats', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Noch in keiner Welt unterwegs' })).toBeVisible();
  });

  test('2/3 · Weltvorschau, Beitritt mit eigener Figur', async () => {
    await page.goto('/worlds/w-neon');
    await expect(page.getByRole('heading', { name: 'Neonhafen', level: 1 })).toBeVisible();
    await expect(page.getByText('Feed, Stories und Chats von Neonhafen siehst du nach dem Beitritt.')).toBeVisible();
    await page.getByRole('link', { name: 'Beitreten' }).first().click();
    await expect(page.getByRole('heading', { name: 'Welt beitreten', level: 1 })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Eigene Figur/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByLabel('Name', { exact: true }).fill('Nia Funke');
    await page.getByLabel('Beruf oder Rolle').fill('Kurierin');
    await page.getByLabel('Hintergrund').fill('Kam mit einem Frachter aus dem Süden.');
    await page.getByLabel('Persönlichkeit').fill('mutig');
    await page.getByLabel('Persönlichkeit').press('Enter');
    const goal = page.locator('.field').filter({ hasText: 'Ziele' }).getByRole('textbox').first();
    await goal.fill('Eine eigene Werkstatt eröffnen');
    await goal.press('Enter');
    await page.getByRole('button', { name: 'Beitreten', exact: true }).click();

    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByRole('heading', { name: 'Neonhafen', level: 1 })).toBeVisible();
    const status = page.getByRole('region', { name: 'Status deiner Figur' });
    await expect(status).toContainText('Nia Funke');
    await expect(status).toContainText('Ansehen');
    await expect(status.getByRole('link', { name: /1 offene Entscheidung/ })).toBeVisible();
    await expect(sidebar().locator('.world-switcher')).toContainText('Neonhafen');
  });

  test('4 · Stories, Feed und Chats gehören zur Welt', async () => {
    await page.goto('/feed');
    // Nur Stories aus Neonhafen
    await expect(page.getByRole('button', { name: 'Story von KITO-7' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Story von Pip Navarro' })).toHaveCount(0);
    await page.locator('.story-ring.add').click();
    const dialog = page.getByRole('dialog', { name: 'Story erstellen' });
    await dialog.getByLabel('Was möchtest du für 24 Stunden teilen?').fill('Story aus dem Test');
    await dialog.getByRole('button', { name: 'Veröffentlichen' }).click();
    await expect(page.getByText('Story veröffentlicht')).toBeVisible();
    await page.getByRole('button', { name: 'Deine Story' }).click();
    await expect(page.locator('.story-text')).toHaveText('Story aus dem Test');
    await page.keyboard.press('Escape');

    // Beitrag als Spielfigur
    await expect(page.getByText('Postet als Nia Funke')).toBeVisible();
    await page.getByLabel('Was passiert gerade?').fill('Mein erster Testbeitrag #e2etest');
    await page.getByRole('button', { name: 'Posten' }).click();
    const post = page.locator('article.post-card').filter({ hasText: 'Mein erster Testbeitrag' });
    await expect(post).toBeVisible();
    await expect(post).toContainText('Nia Funke');
    await expect(page.getByText('+15 XP').first()).toBeVisible();
    // Der Feed enthält nur Beiträge aus Neonhafen
    const worldNames = await page.locator('article.post-card .world-chip').allTextContents();
    expect(worldNames.every((name) => name.includes('Neonhafen'))).toBe(true);

    const like = post.getByRole('button', { name: /Gefällt mir/ });
    await like.click();
    await expect(post.getByRole('button', { name: /Gefällt mir nicht mehr \(1\)/ })).toBeVisible();
    await post.getByRole('button', { name: 'Merken' }).click();
    await expect(post.getByRole('button', { name: 'Lesezeichen entfernen' })).toBeVisible();
    await post.getByRole('button', { name: 'Optionen' }).click();
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click();
    await post.getByLabel('Bearbeiten').fill('Mein erster Testbeitrag (bearbeitet) #e2etest');
    await post.getByRole('button', { name: 'Speichern' }).click();
    await expect(post).toContainText('(bearbeitet)');
    await post.getByRole('link', { name: /Kommentare/ }).click();
    await page.getByLabel('Kommentar schreiben …').fill('Ein Kommentar aus dem Test');
    await page.getByRole('button', { name: 'Senden' }).click();
    await expect(page.locator('.comment').filter({ hasText: 'Ein Kommentar aus dem Test' })).toContainText('Nia Funke');

    // Chat innerhalb der Welt, mit Erinnerung
    await page.goto('/chats/c-mira');
    const input = page.getByLabel('Nachricht an Mira Vex …');
    await input.fill('Hallo Mira! Ich heiße Testerin und ich mag Regen.');
    await input.press('Enter');
    await expect(page.locator('.message.assistant')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.getByText('Demo-Antwort · lokal erzeugt, keine KI')).toBeVisible();
    await page.getByRole('button', { name: 'Erinnerung' }).click();
    const memory = page.getByRole('dialog', { name: 'Gesprächserinnerung' });
    await expect(memory.getByText('Name: Testerin')).toBeVisible();
    await memory.getByRole('button', { name: 'Schließen' }).click();
    await page.getByRole('button', { name: 'Was wird gesendet?' }).click();
    const preview = page.getByRole('dialog', { name: 'Inhalt der nächsten KI-Anfrage' });
    await expect(preview.locator('pre').first()).toContainText('Nia Funke');
    await preview.getByRole('button', { name: 'Schließen' }).click();

    // Neuer Chat bietet nur Figuren dieser Welt an
    await page.goto('/chats');
    await page.getByRole('button', { name: 'Chat starten' }).first().click();
    const picker = page.getByRole('dialog', { name: 'Chat starten' });
    await expect(picker.getByText('Jonah Okafor')).toBeVisible();
    await expect(picker.getByText('Pip Navarro')).toHaveCount(0);
    await expect(picker.getByText('Nia Funke')).toHaveCount(0);
    await picker.getByRole('button', { name: 'Schließen' }).click();

    // Chat mit einer Figur einer anderen Welt ist ohne Beitritt gesperrt
    await page.goto('/chats/c-pip');
    await expect(page.getByRole('heading', { name: 'Noch in keiner Welt unterwegs' })).toBeVisible();
  });

  test('5 · Entscheidung treffen – Verlauf bleibt gespeichert', async () => {
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Aufgaben', level: 1 })).toBeVisible();
    const decision = page.locator('article.decision').filter({ hasText: 'Dein erster Tag in Neonhafen' });
    await expect(decision).toBeVisible();
    const option = decision.locator('.decision-option').filter({ hasText: 'Kontakte knüpfen' });
    await expect(option.locator('.effect-chip').first()).toBeVisible();
    await expect(option).toContainText('Ansehen +3');
    await option.getByRole('button', { name: 'Diese Option wählen' }).click();
    const confirm = page.getByRole('dialog', { name: 'Entscheidung treffen?' });
    await confirm.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByText('Entscheidung getroffen')).toBeVisible();
    await expect(page.locator('.decision-history')).toContainText('Gewählt: Kontakte knüpfen');

    // Nach dem Neuladen ist alles gespeichert
    await page.reload();
    await expect(page.locator('.decision-history')).toContainText('Gewählt: Kontakte knüpfen');
    await expect(page.locator('article.decision').filter({ hasText: 'Dein erster Tag in Neonhafen' })).toHaveCount(0);
    const quest = page.locator('.quest').filter({ hasText: 'Triff deine erste Entscheidung' });
    await quest.getByRole('button', { name: 'Einlösen' }).click();
    await expect(quest.getByText('Eingelöst')).toBeVisible();

    // Die Entscheidung erscheint im Weltgeschehen
    await page.goto('/activity');
    await page.getByRole('tab', { name: 'Weltgeschehen' }).click();
    await expect(page.locator('.event-item').filter({ hasText: 'Nia Funke' }).first()).toBeVisible();
  });

  test('3/6 · Bekannte Figur spielen und Figur kontrolliert wechseln', async () => {
    // Zweite Welt mit einer bekannten Figur über deren Profil
    await page.goto('/characters/c-brandt');
    await expect(page.getByRole('heading', { name: /Helena Brandt/, level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Bekannte Figur spielen' }).click();
    await expect(page.getByRole('radio', { name: /Helena Brandt/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Beitreten', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Regierungsviertel', level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Status deiner Figur' })).toContainText('Helena Brandt');
    // Stories der neuen Welt – nicht die aus Neonhafen
    await expect(page.getByRole('button', { name: 'Story von KITO-7' })).toHaveCount(0);

    // Weltwechsel über die Seitenleiste
    await sidebar().getByRole('button', { name: 'Welt wechseln' }).click();
    await page.getByRole('menuitem', { name: 'Zu Neonhafen wechseln' }).click();
    await expect(page.getByRole('heading', { name: 'Neonhafen', level: 1 })).toBeVisible();
    await expect(page.locator('article.post-card').filter({ hasText: 'Mein erster Testbeitrag' })).toBeVisible();

    // Figurenwechsel in Neonhafen
    await page.goto('/worlds/w-neon/join');
    await page.getByRole('radio', { name: /Bekannte Figur spielen/ }).click();
    await page.getByRole('radio', { name: /Jonah Okafor/ }).click();
    await page.getByRole('button', { name: 'Figur wechseln' }).click();
    const confirm = page.getByRole('dialog', { name: 'Figur wechseln?' });
    await expect(confirm).toContainText('Nia Funke wird pausiert');
    await confirm.getByRole('button', { name: 'Figur wechseln' }).click();
    await expect(page.getByRole('region', { name: 'Status deiner Figur' })).toContainText('Jonah Okafor');

    await page.goto('/profile');
    await page.getByRole('tab', { name: 'Deine Spielfiguren' }).click();
    const nia = page.locator('.player-row').filter({ hasText: 'Nia Funke' });
    await expect(nia).toContainText('Pausiert');
    await expect(page.locator('.player-row').filter({ hasText: 'Helena Brandt' })).toContainText('Aktiv');
    await nia.getByRole('button', { name: 'Wieder spielen' }).click();
    await expect(page.getByText('Du spielst wieder Nia Funke.')).toBeVisible();
    await expect(page.locator('.player-row').filter({ hasText: 'Jonah Okafor' })).toContainText('Pausiert');
    await page.getByRole('tab', { name: 'Beiträge' }).click();
    await expect(page.getByText('Mein erster Testbeitrag (bearbeitet)')).toBeVisible();
  });

  test('6 · Navigation: Hauptbereiche und weitere Bereiche', async () => {
    for (const [label, heading] of [
      ['Feed', 'Neonhafen'],
      ['Aufgaben', 'Aufgaben'],
      ['Chats', 'Chats'],
      ['Aktivität', 'Aktivität'],
      ['Entdecken', 'Entdecken'],
      ['Charaktere', 'Charaktere'],
      ['Suche', 'Suche'],
      ['Shop', 'Shop'],
      ['Weltanpassung', 'Weltanpassung'],
      ['Welten', 'Welten'],
      ['Fortschritt', 'Fortschritt'],
      ['Einstellungen', 'Einstellungen'],
    ]) {
      // Zähler (z. B. ungelesene Mitteilungen) gehören zum Linknamen.
      await sidebar().getByRole('link', { name: new RegExp(`^${label}( \\d+)?$`) }).click();
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    }
    await sidebar().getByRole('link', { name: 'Profil', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nia Funke', level: 1 })).toBeVisible();

    await page.goto('/search');
    await page.getByLabel('Suchbegriff').fill('Spotlight');
    await expect(page.locator('.world-card').filter({ hasText: 'Spotlight Boulevard' })).toBeVisible();

    await page.goto('/shop');
    await expect(page.getByText('Kein Echtgeld', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Für 90 Funken freischalten' }).first()).toBeVisible();
  });

  test('7 · Welt: Zeit vergehen lassen und Ereignis auslösen', async () => {
    await page.goto('/worlds/w-brass');
    await page.getByRole('link', { name: 'Beitreten' }).first().click();
    await page.getByLabel('Name', { exact: true }).fill('Gast Zahnrad');
    await page.getByRole('button', { name: 'Beitreten', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Messinghafen', level: 1 })).toBeVisible();

    await page.goto('/worlds/w-brass');
    const dayBadge = page.locator('.world-hero .badge').filter({ hasText: /^Tag \d+$/ });
    const before = Number((await dayBadge.textContent())?.replace(/\D/g, ''));
    await page.getByRole('button', { name: 'Zeit vergehen lassen' }).click();
    await expect(dayBadge).toHaveText(`Tag ${before + 1}`);
    await expect(page.locator('.event-item').first()).toBeVisible();

    await page.getByRole('button', { name: 'Ereignis auslösen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ereignis auslösen' });
    await expect(dialog.getByRole('radio', { name: /Gala-Abend/ })).toContainText('Im Shop freischalten');
    await expect(dialog.getByRole('button', { name: /Gast Zahnrad/ })).toHaveCount(0);
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

  test('7 · Eigenen Charakter und eigene Welt erstellen', async () => {
    await page.goto('/characters/new');
    await page.getByLabel('Name', { exact: true }).fill('Testa Probe');
    await page.getByLabel('Handle').fill('testa_probe');
    await page.getByLabel('Kurzvorstellung').fill('Ich teste alles.');
    await page.getByLabel('Welt', { exact: true }).selectOption({ label: 'Neonhafen' });
    await page.getByLabel('Charakterzüge').fill('gründlich');
    await page.getByLabel('Charakterzüge').press('Enter');
    await page.getByRole('switch', { name: 'An eine reale Person angelehnt' }).click();
    await page.getByRole('button', { name: 'Charakter erstellen' }).last().click();
    await expect(page.getByRole('heading', { name: 'Testa Probe', level: 1 })).toBeVisible();
    await expect(page.getByText('Fiktive KI-Simulation').first()).toBeVisible();

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

  test('7 · Quest einlösen erhöht die XP', async () => {
    await page.goto('/progress');
    const quest = page.locator('.quest').filter({ hasText: 'Dein erster Beitrag' });
    await quest.getByRole('button', { name: 'Einlösen' }).click();
    await expect(quest.getByText('Eingelöst')).toBeVisible();
    await expect(page.getByText('Belohnung eingelöst')).toBeVisible();
  });

  test('7 · Sprachwechsel auf Englisch und zurück', async () => {
    await page.goto('/settings');
    await page.getByLabel('Sprache').selectOption('en');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Main navigation' }).getByRole('link', { name: 'Tasks' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await page.getByLabel('Language').selectOption('de');
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
  });

  test('7 · API-Schlüssel wird gespeichert, aber nie an den Browser gegeben', async () => {
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

  test('6 · Mobile Ansicht mit unterer Navigation, Weltwechsel und Funken', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page).toHaveURL(/\/feed$/);
    const bottom = page.locator('nav.bottom-nav');
    await expect(bottom).toBeVisible();
    for (const label of ['Feed', 'Aufgaben', 'Chats', 'Aktivität', 'Profil']) {
      await expect(bottom.getByRole('link', { name: label })).toBeVisible();
    }
    await bottom.getByRole('link', { name: 'Aufgaben' }).click();
    await expect(page.getByRole('heading', { name: 'Aufgaben', level: 1 })).toBeVisible();
    await bottom.getByRole('link', { name: 'Chats' }).click();
    await expect(page.getByRole('heading', { name: 'Chats', level: 1 })).toBeVisible();
    const topbar = page.locator('header.topbar');
    await expect(topbar.locator('.coin-chip')).toBeVisible();
    await topbar.getByRole('button', { name: 'Weitere Bereiche' }).click();
    await page.getByRole('menuitem', { name: 'Entdecken' }).click();
    await expect(page.getByRole('heading', { name: 'Entdecken', level: 1 })).toBeVisible();
    for (const path of ['/feed', '/tasks', '/discover', '/profile', '/shop', '/worlds/w-neon/join']) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `Kein horizontales Scrollen auf ${path}`).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1360, height: 900 });
  });

  test('Alle Daten löschen setzt die App zurück', async () => {
    await page.goto('/settings#privacy');
    await page.getByLabel('Zur Bestätigung RESET eingeben').fill('RESET');
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page.getByRole('dialog', { name: 'Willkommen bei SocialVerse' })).toBeVisible();
    const res = await page.request.get('/api/posts?author=user');
    expect((await res.json()).items).toHaveLength(0);
    const boot = await page.request.get('/api/bootstrap');
    expect((await boot.json()).joinedWorlds).toHaveLength(0);
  });
});
