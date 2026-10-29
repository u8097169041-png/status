// Prüft, ob eine lokale KI (Ollama) und ein passendes Modell vorhanden sind, und empfiehlt die nächsten Schritte.
// Lädt nichts herunter und ändert nichts am System. Aufruf: npm run ai:check
//   --recommend  gibt nur „<modell> <größe-in-GB>“ der Empfehlung aus (für ki-einrichten.bat)
//   --short      eine Zeile Status (für start.bat)
import { spawnSync } from 'node:child_process';
import { existsSync, statfsSync } from 'node:fs';
import { cpus, freemem, homedir, platform, totalmem } from 'node:os';
import { join, resolve } from 'node:path';

const args = new Set(process.argv.slice(2));
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Ungültige .env: Standardwerte verwenden.
  }
}

const isWin = platform() === 'win32';
const enabled = !['0', 'false', 'no', 'nein', 'off'].includes((process.env.LOCAL_AI_ENABLED ?? '').trim().toLowerCase());
const baseUrl = (process.env.LOCAL_AI_BASE_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const fixedModel = process.env.LOCAL_AI_MODEL?.trim() || '';
const ramGb = totalmem() / 1024 ** 3;

/** Empfehlung nach Arbeitsspeicher. Größen sind ungefähre Download-Größen der Ollama-Bibliothek. */
function recommend() {
  if (ramGb >= 15) return { model: 'gemma3:4b', sizeGb: 3.3, note: 'gute Antworten auf Deutsch und Englisch' };
  if (ramGb >= 7.5) return { model: 'qwen2.5:3b', sizeGb: 1.9, note: 'guter Kompromiss für 8 GB Arbeitsspeicher' };
  return { model: 'qwen2.5:1.5b', sizeGb: 1.0, note: 'sehr klein – Antworten sind einfacher; die simulierte KI bleibt eine Alternative' };
}

function freeDiskGb() {
  try {
    const target = isWin ? join(process.env.USERPROFILE || homedir()) : homedir();
    const s = statfsSync(target);
    return (s.bavail * s.bsize) / 1024 ** 3;
  } catch {
    return null;
  }
}

function findOllamaBinary() {
  const probe = spawnSync('ollama', ['--version'], { encoding: 'utf8', timeout: 5000 });
  if (probe.status === 0) return { path: 'ollama', version: (probe.stdout || probe.stderr).trim() };
  if (isWin && process.env.LOCALAPPDATA) {
    const p = join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
    if (existsSync(p)) return { path: p, version: null };
  }
  return null;
}

async function getJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const rec = recommend();
if (args.has('--recommend')) {
  console.log(`${rec.model} ${rec.sizeGb}`);
  process.exit(0);
}

let version = null;
let models = [];
let reachable = false;
if (enabled) {
  try {
    const v = await getJson('/api/version');
    const tags = await getJson('/api/tags');
    version = typeof v.version === 'string' ? v.version : '?';
    models = (Array.isArray(tags.models) ? tags.models : [])
      .map((m) => String(m.name ?? ''))
      .filter((n) => n && !/embed|bge-|minilm|rerank/i.test(n));
    reachable = true;
  } catch {
    reachable = false;
  }
}
const hasFixed = fixedModel && models.some((m) => m === fixedModel || m === `${fixedModel}:latest`);
const ready = enabled && reachable && (fixedModel ? hasFixed : models.length > 0);

if (args.has('--short')) {
  if (!enabled) console.log('  KI:        lokale KI ausgeschaltet (LOCAL_AI_ENABLED=false) – simulierte KI aktiv');
  else if (ready) console.log(`  KI:        lokale KI gefunden (${fixedModel || models[0]})`);
  else if (reachable) console.log('  KI:        Ollama läuft, aber kein passendes Modell – simulierte KI aktiv (ki-einrichten.bat hilft)');
  else console.log('  KI:        keine lokale KI gefunden – simulierte KI aktiv (optional: ki-einrichten.bat)');
  process.exit(0);
}

const disk = freeDiskGb();
const binary = enabled && !reachable ? findOllamaBinary() : null;
const line = (ok, text) => console.log(`  ${ok === null ? '·' : ok ? '✓' : '✗'} ${text}`);

console.log('');
console.log('  SocialVerse – Prüfung der lokalen KI');
console.log('  ------------------------------------');
line(null, `System: ${platform()} · ${cpus().length} CPU-Kerne · ${ramGb.toFixed(1)} GB RAM (frei: ${(freemem() / 1024 ** 3).toFixed(1)} GB)` + (disk !== null ? ` · ${disk.toFixed(1)} GB freier Speicher` : ''));
if (!enabled) {
  line(null, 'Lokale KI ist in .env ausgeschaltet (LOCAL_AI_ENABLED=false). Es antwortet die simulierte KI.');
  process.exit(0);
}
line(reachable, reachable ? `Ollama erreichbar unter ${baseUrl} (Version ${version})` : `Keine Ollama-Laufzeit unter ${baseUrl} erreichbar`);
if (reachable) {
  line(models.length > 0, models.length ? `Installierte Modelle: ${models.join(', ')}` : 'Noch kein Sprachmodell installiert');
  if (fixedModel) line(Boolean(hasFixed), `LOCAL_AI_MODEL=${fixedModel} ${hasFixed ? 'ist installiert' : 'ist NICHT installiert'}`);
}
console.log('');

if (ready) {
  console.log('  Alles bereit: SocialVerse verwendet die lokale KI automatisch (Einstellungen > KI & Modelle).');
  console.log('  Kosten: keine – das Modell läuft auf diesem Computer.');
  console.log('');
  process.exit(0);
}

console.log('  Empfohlene kostenlose Einrichtung:');
if (!reachable) {
  if (binary) {
    console.log('   1. Ollama ist installiert, läuft aber nicht. Starte die App „Ollama“ (Startmenü) bzw. im Terminal: ollama serve');
  } else if (isWin) {
    console.log('   1. Ollama installieren (offizielles Paket, Download ca. 1–2 GB):');
    console.log('        winget install --id Ollama.Ollama -e');
    console.log('      oder Installer von https://ollama.com/download/windows – oder einfach ki-einrichten.bat ausführen.');
  } else {
    console.log('   1. Ollama installieren: https://ollama.com/download (Anleitung für macOS/Linux dort).');
  }
}
const step = reachable ? 1 : 2;
if (!fixedModel || !hasFixed) {
  const model = fixedModel || rec.model;
  console.log(`   ${step}. Modell laden (${fixedModel ? 'aus LOCAL_AI_MODEL' : `Empfehlung für ${ramGb.toFixed(0)} GB RAM: ${rec.note}`}):`);
  console.log(`        ollama pull ${model}`);
  if (!fixedModel) console.log(`      Download ca. ${rec.sizeGb} GB${disk !== null && disk < rec.sizeGb + 2 ? ' – ACHTUNG: wenig freier Speicherplatz!' : ''}.`);
}
console.log(`   ${step + 1}. SocialVerse neu starten oder in Einstellungen > KI & Modelle auf „Erneut prüfen“ klicken.`);
console.log('');
console.log('  Ohne lokale KI funktioniert SocialVerse trotzdem: Es antwortet die simulierte KI (kostenlos, offline).');
console.log('');
