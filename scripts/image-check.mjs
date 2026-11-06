// Prüft Grafikkarte und lokale Bild-KI (Stable Diffusion WebUI Forge/AUTOMATIC1111 oder ComfyUI) und empfiehlt
// eine passende, kostenlose Einrichtung. Lädt nichts herunter und ändert nichts am System. Aufruf: npm run image:check
//   --short   eine Zeile Status (für start.bat)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform, totalmem } from 'node:os';
import { resolve } from 'node:path';

const args = new Set(process.argv.slice(2));
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Ungültige .env: Standardwerte verwenden.
  }
}

const os = platform();
const backend = (process.env.IMAGE_BACKEND ?? 'auto').trim().toLowerCase();
const sdUrl = (process.env.IMAGE_SDWEBUI_URL?.trim() || 'http://127.0.0.1:7860').replace(/\/+$/, '');
const comfyUrl = (process.env.IMAGE_COMFYUI_URL?.trim() || 'http://127.0.0.1:8188').replace(/\/+$/, '');

async function getJson(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Grafikkarte erkennen: NVIDIA über nvidia-smi (Name und Grafikspeicher), sonst nur den Namen. */
function detectGpu() {
  const smi = spawnSync('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 6000 });
  if (smi.status === 0 && smi.stdout.trim()) {
    const [name, mem, driver] = smi.stdout.trim().split('\n')[0].split(',').map((s) => s.trim());
    return { vendor: 'nvidia', name, vramGb: Number(mem) / 1024, driver };
  }
  if (os === 'win32') {
    const ps = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join "; "'], { encoding: 'utf8', timeout: 8000 });
    const name = ps.status === 0 ? ps.stdout.trim() : '';
    if (name) return { vendor: /nvidia/i.test(name) ? 'nvidia' : /amd|radeon/i.test(name) ? 'amd' : /intel/i.test(name) ? 'intel' : 'other', name, vramGb: null, driver: null };
  }
  if (os === 'darwin') {
    const sp = spawnSync('sysctl', ['-n', 'machdep.cpu.brand_string'], { encoding: 'utf8', timeout: 4000 });
    if (/apple/i.test(sp.stdout ?? '')) return { vendor: 'apple', name: sp.stdout.trim(), vramGb: totalmem() / 1024 ** 3, driver: null };
  }
  if (os === 'linux') {
    const lspci = spawnSync('sh', ['-c', 'lspci 2>/dev/null | grep -iE "vga|3d|display"'], { encoding: 'utf8', timeout: 4000 });
    const name = lspci.stdout?.trim().split('\n')[0] ?? '';
    if (name) return { vendor: /nvidia/i.test(name) ? 'nvidia' : /amd|radeon/i.test(name) ? 'amd' : /intel/i.test(name) ? 'intel' : 'other', name, vramGb: null, driver: null };
  }
  return null;
}

async function probeSd() {
  try {
    const o = await getJson(`${sdUrl}/sdapi/v1/options`);
    return { reachable: true, model: typeof o.sd_model_checkpoint === 'string' ? o.sd_model_checkpoint : null };
  } catch {
    return { reachable: false, model: null };
  }
}

async function probeComfy() {
  try {
    await getJson(`${comfyUrl}/system_stats`);
    const info = await getJson(`${comfyUrl}/object_info/CheckpointLoaderSimple`);
    const list = info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    return { reachable: true, models: Array.isArray(list) ? list : [] };
  } catch {
    return { reachable: false, models: [] };
  }
}

const sd = backend === 'none' || backend === 'comfyui' ? { reachable: false, model: null } : await probeSd();
const comfy = backend === 'none' || backend === 'sdwebui' ? { reachable: false, models: [] } : await probeComfy();
const ready = (sd.reachable && sd.model) || (comfy.reachable && comfy.models.length > 0);

if (args.has('--short')) {
  if (backend === 'none') console.log('  Bild-KI:   ausgeschaltet (IMAGE_BACKEND=none) – gezeichnete Porträts');
  else if (sd.reachable && sd.model) console.log(`  Bild-KI:   Forge/A1111 gefunden (${sd.model})`);
  else if (comfy.reachable && comfy.models.length) console.log(`  Bild-KI:   ComfyUI gefunden (${comfy.models[0]})`);
  else console.log('  Bild-KI:   keine lokale Bild-KI gefunden – gezeichnete Porträts (optional: npm run image:check)');
  process.exit(0);
}

const gpu = detectGpu();
const line = (ok, text) => console.log(`  ${ok === null ? '·' : ok ? '✓' : '✗'} ${text}`);
console.log('');
console.log('  SocialVerse – Prüfung der lokalen Bild-KI');
console.log('  -----------------------------------------');
line(null, `System: ${os} · ${(totalmem() / 1024 ** 3).toFixed(1)} GB RAM`);
line(gpu ? true : null, gpu ? `Grafikkarte: ${gpu.name}${gpu.vramGb ? ` · ${gpu.vramGb.toFixed(1)} GB ${gpu.vendor === 'apple' ? 'gemeinsamer Speicher' : 'Grafikspeicher'}` : ''}${gpu.driver ? ` · Treiber ${gpu.driver}` : ''}` : 'Keine Grafikkarte erkannt (oder nvidia-smi nicht verfügbar)');
if (backend === 'none') {
  line(null, 'Bild-KI ist in .env ausgeschaltet (IMAGE_BACKEND=none). Es werden gezeichnete Porträts und Szenenkarten verwendet.');
  console.log('');
  process.exit(0);
}
if (backend !== 'comfyui') line(sd.reachable, sd.reachable ? `Forge/AUTOMATIC1111 erreichbar unter ${sdUrl}${sd.model ? ` · Modell: ${sd.model}` : ' · kein Modell geladen'}` : `Keine Forge/A1111-API unter ${sdUrl} (Start mit --api nötig)`);
if (backend !== 'sdwebui') line(comfy.reachable, comfy.reachable ? `ComfyUI erreichbar unter ${comfyUrl} · Modelle: ${comfy.models.join(', ') || 'keine'}` : `Kein ComfyUI unter ${comfyUrl}`);
console.log('');

if (ready) {
  console.log('  Alles bereit: SocialVerse erzeugt Profil-, Titel- und Szenenbilder lokal (Einstellungen > Bild-KI).');
  console.log('  Kosten: keine – die Bilder entstehen auf diesem Computer. Ein Bild dauert je nach Grafikkarte Sekunden bis Minuten.');
  console.log('');
  process.exit(0);
}

// Empfehlung nach Hardware – nur Hinweise, keine Downloads.
const vram = gpu?.vramGb ?? null;
console.log('  Empfehlung (kostenlos, ohne API-Schlüssel):');
if (gpu?.vendor === 'nvidia' && vram !== null && vram >= 7.5) {
  console.log(`   Deine NVIDIA-Karte (${vram.toFixed(0)} GB) schafft SDXL-Modelle – beste Fotoqualität.`);
  console.log('   Modell: ein fotorealistisches SDXL-Modell, z. B. „RealVisXL“ oder „Juggernaut XL“ (Download ca. 6–7 GB).');
  console.log('   Dauer: grob 10–40 Sekunden pro Bild.');
} else if (gpu?.vendor === 'nvidia' && vram !== null && vram >= 3.5) {
  console.log(`   Deine NVIDIA-Karte (${vram.toFixed(0)} GB) eignet sich für SD-1.5-Modelle.`);
  console.log('   Modell: ein fotorealistisches SD-1.5-Modell, z. B. „Realistic Vision“ (Download ca. 2 GB). Forge kommt mit wenig Grafikspeicher gut zurecht.');
  console.log('   Dauer: grob 15–60 Sekunden pro Bild.');
} else if (gpu?.vendor === 'nvidia') {
  console.log('   NVIDIA-Karte erkannt, Grafikspeicher unbekannt. Mit mindestens 4 GB: SD-1.5-Modell, ab 8 GB: SDXL-Modell.');
} else if (gpu?.vendor === 'amd') {
  console.log('   AMD-Grafikkarte: Bild-KI ist möglich, die Einrichtung ist unter Windows aber aufwendiger (ComfyUI mit DirectML/ZLUDA).');
  console.log('   Empfehlung: SD-1.5-Modell (ca. 2 GB). Ohne passende Einrichtung bleibt es bei gezeichneten Porträts.');
} else if (gpu?.vendor === 'apple') {
  console.log('   Apple Silicon: ComfyUI läuft mit Metal-Beschleunigung. Mit 16 GB oder mehr: SDXL, sonst SD 1.5.');
} else {
  console.log('   Ohne geeignete Grafikkarte dauert ein Bild auf dem Prozessor mehrere Minuten. Empfehlung: Bild-KI auslassen –');
  console.log('   SocialVerse zeigt dann gezeichnete Porträts und Szenenkarten (kostenlos, offline).');
}
console.log('');
console.log('   Einrichtung (eine Variante genügt):');
console.log('    A) Stable Diffusion WebUI Forge (einfach):');
console.log('       1. Paket von der offiziellen GitHub-Seite „lllyasviel/stable-diffusion-webui-forge“ laden und entpacken (mehrere GB).');
console.log('       2. In webui-user.bat die Zeile „set COMMANDLINE_ARGS=--api“ eintragen – ohne --api kann SocialVerse nicht zugreifen.');
console.log('       3. Modelldatei (.safetensors) nach models\\Stable-diffusion kopieren, Forge starten und das Modell auswählen.');
console.log(`       4. SocialVerse findet Forge automatisch unter ${sdUrl}.`);
console.log('    B) ComfyUI (flexibel):');
console.log('       1. Portable Windows-Version von der offiziellen GitHub-Seite „comfyanonymous/ComfyUI“ laden und entpacken.');
console.log('       2. Modelldatei nach ComfyUI\\models\\checkpoints kopieren und run_nvidia_gpu.bat starten.');
console.log(`       3. SocialVerse findet ComfyUI automatisch unter ${comfyUrl} (Modellwahl optional: IMAGE_COMFYUI_CHECKPOINT).`);
console.log('');
console.log('   Hinweise: Modelle nur von den offiziellen Modellseiten laden (.safetensors, keine .ckpt-Dateien unbekannter Herkunft)');
console.log('   und die Lizenz auf der Modellseite prüfen. Bilder entstehen ausschließlich lokal; es fallen keine Kosten an.');
console.log('   Danach: SocialVerse neu starten oder in Einstellungen > Bild-KI auf „Erneut prüfen“ klicken.');
console.log('');
