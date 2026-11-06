import { expect, test, type Page } from '@playwright/test';

/**
 * Lebensmodus und Bilder über die Oberfläche.
 * Ohne KI (Port 3199): regelbasierte Einrichtung, Spielzüge, Zeitsprung, Szenenkarte statt Foto, Dauerhaftigkeit.
 * Mit simulierter lokaler KI und simulierter Bild-KI (Port 3197): KI-Erzählung, Szenenfotos in Geschichte und Chat.
 */
const H = { 'X-SocialVerse': '1' };

async function startStory(page: Page, example: string) {
  await page.goto('/life');
  await page.getByRole('link', { name: 'Neue Geschichte' }).first().click();
  await page.getByRole('button', { name: example }).click();
  await page.getByRole('button', { name: 'Entwurf erstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Entwurf prüfen' })).toBeVisible({ timeout: 20_000 });
}

test.describe.serial('Lebensmodus ohne KI', () => {
  test.beforeAll(async ({ request }) => {
    await request.patch('/api/settings', { headers: H, data: { onboardingDone: true } });
  });

  test('Modus wechseln, Geschichte einrichten und spielen', async ({ page }) => {
    await page.goto('/discover');
    await page.locator('.sidebar').getByRole('link', { name: 'Leben' }).click();
    await expect(page).toHaveURL(/\/life$/);
    await expect(page.getByRole('heading', { name: 'Lebensgeschichten' })).toBeVisible();
    await expect(page.getByText('Noch keine Lebensgeschichte')).toBeVisible();

    await startStory(page, 'Mafiaboss');
    await expect(page.getByText('Ohne KI ausgelesen.')).toBeVisible();
    await expect(page.getByLabel('Name deiner Figur')).toHaveValue('Don Salvatore Greco');
    await expect(page.getByLabel('Rollentyp')).toHaveValue('crime_boss');
    // Startwerte vom Spielsystem: ein Mafiaboss beginnt mit viel Macht.
    const power = page.locator('.life-stat-editor .meter').filter({ hasText: 'Macht' });
    expect(Number(await power.locator('strong').innerText())).toBeGreaterThanOrEqual(80);
    await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('Marco Bellini');
    await expect(page.getByLabel('Ausgangssituation')).toHaveValue(/Viktor im Restaurant/);
    await page.getByRole('button', { name: 'Geschichte starten' }).click();

    await expect(page).toHaveURL(/\/life\/life_/);
    await expect(page.locator('.life-narration').first()).toContainText('Die Geschichte beginnt');
    const suggestions = page.locator('.suggestion');
    await expect(suggestions).toHaveCount(4);
    await expect(page.locator('.suggestion-kind')).toHaveText(['Klug', 'Alternative', 'Riskant', 'Überraschend']);
    const firstTexts = await page.locator('.suggestion-text').allInnerTexts();

    // Vorschlag anklicken: wird als eigene Handlung übernommen, das Spielsystem würfelt.
    const picked = firstTexts[0];
    await suggestions.first().click();
    await expect(page.locator('.message.user .bubble').last()).toHaveText(picked);
    await expect(page.locator('.life-resolution').last()).toContainText(/Chance \d+ %/);
    await expect(page.locator('.suggestion')).toHaveCount(4);
    expect(await page.locator('.suggestion-text').allInnerTexts()).not.toEqual(firstTexts);

    // Freie Eingabe bleibt möglich; ein Versprechen wird gemerkt.
    const input = page.getByLabel('Deine Handlung');
    await input.fill('Ich verspreche Marco, dass er am Hafen beteiligt wird.');
    await input.press('Enter');
    await expect(page.locator('.message.user .bubble').last()).toContainText('Ich verspreche Marco');
    await expect(page.locator('.life-narration').last()).not.toHaveClass(/pending/);
    await expect(page.locator('.life-side')).toContainText('Ich verspreche Marco');

    // Zeit vergehen lassen: Tage vergehen, Figuren handeln selbst.
    const dayText = await page.locator('.life-header .xsmall').innerText();
    await page.getByRole('button', { name: 'Zeit vergehen lassen' }).click();
    await expect(page.locator('.life-narration').last()).toContainText('Einige Tage vergehen');
    await expect(page.locator('.life-header .xsmall')).not.toHaveText(dayText);

    // Ohne Bild-KI: Szenenkarte statt Foto, mit Hinweis im Dialog.
    await page.getByRole('button', { name: 'Bild des Moments' }).click();
    const dialog = page.getByRole('dialog', { name: 'Bild des aktuellen Moments' });
    await expect(dialog.getByText(/Keine lokale Bild-KI erreichbar/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Bild erzeugen' }).click();
    await expect(page.locator('.life-image .scene-card')).toBeVisible();

    // Gedächtnis zeigt, was die Spielfigur weiß – kritische Fakten markiert.
    await page.locator('.life-side-tabs summary').filter({ hasText: 'Gedächtnis' }).click();
    await expect(page.locator('.life-memories li.critical').first()).toBeVisible();

    // Nach dem Neuladen ist alles noch da.
    const messages = await page.locator('.life-messages > *').count();
    await page.reload();
    await expect(page.locator('.life-messages .life-narration').first()).toBeVisible();
    expect(await page.locator('.life-messages > *').count()).toBe(messages);
    await expect(page.locator('.suggestion')).toHaveCount(4);
  });

  test('Mobil: Reiter für Geschichte, Status und Figuren', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/life');
    await page.locator('.life-story-card').first().click();
    await expect(page.locator('.suggestion')).toHaveCount(4);
    await page.getByRole('tab', { name: 'Status' }).click();
    await expect(page.getByRole('heading', { name: 'Deine Werte' })).toBeVisible();
    await expect(page.locator('.life-main')).toBeHidden();
    await page.getByRole('tab', { name: 'Figuren' }).click();
    await expect(page.locator('.life-character').filter({ hasText: 'Marco Bellini' })).toBeVisible();
    await page.getByRole('tab', { name: 'Geschichte' }).click();
    await expect(page.locator('.life-main')).toBeVisible();
    // Kein waagerechtes Scrollen der Seite.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('Geschichte löschen', async ({ page }) => {
    await page.goto('/life');
    await page.locator('.life-story-card').first().click();
    await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
    await page.getByRole('menuitem', { name: 'Geschichte löschen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect(page).toHaveURL(/\/life$/);
    await expect(page.getByText('Noch keine Lebensgeschichte')).toBeVisible();
  });
});

test.describe.serial('Lebensmodus und Bilder mit lokaler KI und Bild-KI (simuliert)', () => {
  test.use({ baseURL: 'http://127.0.0.1:3197' });

  test.beforeAll(async ({ request }) => {
    // Die KI-Tests enden im Modus „Nur simulierte KI“ mit Server-Freigabe: zurück zur kostenlosen lokalen KI.
    await request.patch('/api/settings', { headers: H, data: { onboardingDone: true, ai: { mode: 'auto', serverConsent: false } } });
    const pip = await (await request.get('/api/characters/c-pip')).json();
    // Bereits beigetreten (KI-Tests) ist ebenfalls in Ordnung.
    await request.post(`/api/worlds/${pip.character.worldId}/join`, { headers: H, data: { mode: 'custom', character: { name: 'Bild-Testerin' } } });
  });

  test('Bild-KI wird erkannt und in den Einstellungen angezeigt', async ({ page }) => {
    await page.goto('/settings#images');
    const section = page.locator('section#images');
    await expect(section.locator('.diag-row').first()).toContainText('Erreichbar: Forge/A1111');
    await expect(section).toContainText('juggernautXL_v9.safetensors [mock]');
    await expect(section).toContainText('Porträt 896×1152');
  });

  test('KI erzählt, Szenenfoto entsteht aus dem Verlauf und bleibt gespeichert', async ({ page }) => {
    await startStory(page, 'Mafiaboss');
    await expect(page.getByText('Mit KI ausgelesen. Startwerte vom Spielsystem.')).toBeVisible();
    await page.getByRole('button', { name: 'Geschichte starten' }).click();
    await expect(page.locator('.life-narration').first()).toContainText('Lokale KI erzählt', { timeout: 20_000 });
    await expect(page.locator('.suggestion-text').first()).toContainText(/in Ruhe die Lage besprechen/);
    await page.locator('.suggestion-risky').click();
    await expect(page.locator('.life-narration').last()).toContainText('Du versuchst', { timeout: 20_000 });
    await expect(page.locator('.life-resolution').last()).toContainText(/Chance \d+ %/);
    await page.getByRole('button', { name: 'Bild des Moments' }).click();
    const dialog = page.getByRole('dialog', { name: 'Bild des aktuellen Moments' });
    await expect(dialog.getByText(/Lokale Bild-KI: Forge\/A1111/)).toBeVisible();
    await dialog.getByLabel('Eigene Beschreibung (optional)').fill('Kerzenlicht im Restaurant');
    await dialog.getByRole('button', { name: 'Bild erzeugen' }).click();
    const photo = page.locator('.life-image .scene-image img');
    await expect(photo).toBeVisible({ timeout: 20_000 });
    expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText('Bild gespeichert')).toHaveCount(1);
    // Szenenprompt: fotorealistisch, mit eigener Beschreibung.
    const calls = (await (await page.request.get('http://127.0.0.1:3194/mock/calls')).json()) as { prompt: string; negative: string }[];
    const scene = calls.find((c) => c.prompt.includes('Kerzenlicht im Restaurant'))!;
    expect(scene.prompt).toMatch(/photo/i);
    expect(scene.negative).toMatch(/cartoon/);
    await page.reload();
    await expect(page.locator('.life-image .scene-image img')).toBeVisible();
  });

  test('Social-Chat: vier Vorschläge und Szenenfoto per Bildschaltfläche', async ({ page }) => {
    await page.goto('/chats/c-pip');
    const input = page.getByLabel('Nachricht an Pip Navarro …');
    await input.fill('Lust auf eine Runde durch die Hydroponik?');
    await input.press('Enter');
    const chips = page.locator('.chat-suggestions .suggestion');
    await expect(chips).toHaveCount(4, { timeout: 20_000 });
    const text = await chips.first().locator('.suggestion-text').innerText();
    await chips.first().click();
    await expect(page.locator('.message.user .bubble').last()).toHaveText(text);
    await expect(page.locator('.chat-suggestions .suggestion')).toHaveCount(4, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Bild erzeugen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bild erzeugen' }).click();
    const photo = page.locator('.image-message .scene-image img');
    await expect(photo).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.locator('.image-message .scene-image img')).toBeVisible();
  });
});
