// Lokaler Nachbau der Stable-Diffusion-WebUI/Forge-API (A1111) für Ende-zu-Ende-Tests.
// Kein Modell, keine Downloads: Jede Anfrage liefert ein kleines, echtes PNG (Farbverlauf aus dem Seed).
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';

const port = Number(process.argv[2] ?? 3194);
const delayMs = Number(process.env.MOCK_SD_DELAY_MS ?? 300);
const calls = [];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Farbverlauf als PNG (RGB, 8 Bit). */
function png(width, height, seed) {
  const h1 = seed % 360;
  const h2 = (h1 + 70) % 360;
  const toRgb = (h, l) => {
    const a = 0.6 * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  };
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      const [r, g, b] = toRgb(t < 0.5 ? h1 : h2, 0.25 + 0.4 * t);
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/sdapi/v1/options') return send(200, { sd_model_checkpoint: 'juggernautXL_v9.safetensors [mock]' });
  // Nur für Tests: Liste der empfangenen Prompts.
  if (req.method === 'GET' && req.url === '/mock/calls') return send(200, calls);
  if (req.method === 'POST' && req.url === '/sdapi/v1/txt2img') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      const body = JSON.parse(raw || '{}');
      calls.push({ prompt: body.prompt, negative: body.negative_prompt, width: body.width, height: body.height, seed: body.seed });
      await new Promise((r) => setTimeout(r, delayMs));
      // Verkleinert (1/8), damit die Tests schnell bleiben; das Seitenverhältnis bleibt erhalten.
      const image = png(Math.max(8, Math.round(body.width / 8)), Math.max(8, Math.round(body.height / 8)), Number(body.seed) || 1);
      send(200, { images: [image.toString('base64')], info: '{}' });
    });
    return;
  }
  send(404, { detail: 'Not Found' });
}).listen(port, '127.0.0.1');
