// Lokaler Nachbau der Ollama-API für Ende-zu-Ende-Tests (kein echtes Modell, keine Downloads).
// Antwortet wie Ollama gestreamt (NDJSON). Mit TOKEN_DELAY_MS lässt sich eine langsame Generierung simulieren.
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 3196);
const tokenDelayMs = Number(process.env.MOCK_OLLAMA_TOKEN_DELAY_MS ?? 0);

/** Kompakter, gültiger Weltentwurf passend zum angefragten Schema. */
function worldDraft(count) {
  const characters = Array.from({ length: count }, (_, i) => ({
    name: ['Mara Lind', 'Tom Ehrlich', 'Ada Kern', 'Noah Weiß'][i % 4],
    role: 'Bewohnerin',
    tagline: 'Kennt jede Gasse.',
    description: 'Neugierig und hilfsbereit.',
    personality: ['neugierig', 'ehrlich', 'mutig'],
    interests: ['Musik', 'Kaffee'],
    background: 'Lebt seit Jahren hier.',
    writingStyle: 'casual',
  }));
  return {
    name: 'KI-Welt Nebelbucht',
    tagline: 'Eine Bucht voller Geheimnisse.',
    description: 'Von der lokalen KI erzeugt.',
    lore: 'Früher ein Fischerdorf.',
    atmosphere: 'neblig, warm',
    rules: ['Jeder kennt jeden.', 'Nachts läutet die Glocke.', 'Geheimnisse bleiben nie lange geheim.'],
    characters,
  };
}

function replyFor(body) {
  const last = String(body.messages?.at(-1)?.content ?? '').slice(0, 60);
  const format = body.format;
  if (format && typeof format === 'object' && format.properties?.characters) {
    return JSON.stringify(worldDraft(format.properties.characters.minItems ?? 3));
  }
  if (format) return JSON.stringify({ reply: `Lokale KI-Antwort: Du schreibst „${last}“.`, tone: 'warm' });
  return 'OK';
}

const server = createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/api/version') return send(200, { version: '0.9.0-mock' });
  if (req.method === 'GET' && req.url === '/api/tags') {
    return send(200, {
      models: [
        { name: 'gemma3:4b', size: 3_338_801_804, details: { family: 'gemma3', families: ['gemma3'], parameter_size: '4.3B' } },
        { name: 'nomic-embed-text:latest', size: 274_302_450, details: { family: 'nomic-bert', families: ['nomic-bert'], parameter_size: '137M' } },
      ],
    });
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      const body = JSON.parse(raw || '{}');
      const content = replyFor(body);
      if (body.stream === false) {
        return send(200, { model: body.model, message: { role: 'assistant', content }, done: true, prompt_eval_count: 250, eval_count: 20 });
      }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      const pieces = content.match(/.{1,12}/gs) ?? [content];
      let closed = false;
      res.on('close', () => (closed = true));
      for (const piece of pieces) {
        if (closed) return;
        res.write(`${JSON.stringify({ model: body.model, message: { role: 'assistant', content: piece }, done: false })}\n`);
        if (tokenDelayMs) await new Promise((r) => setTimeout(r, tokenDelayMs));
      }
      res.end(
        `${JSON.stringify({ model: body.model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 250, eval_count: pieces.length, eval_duration: pieces.length * 50_000_000, load_duration: 1_200_000_000 })}\n`,
      );
    });
    return;
  }
  send(404, { error: 'not found' });
});
server.listen(port, '127.0.0.1');
