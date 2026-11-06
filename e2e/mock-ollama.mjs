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

/** Erzählung einer Lebensgeschichte: nutzt die vom Spielsystem gelieferte Szene und schlägt vier passende Handlungen vor. */
function narration(body) {
  const user = String(body.messages?.at(-1)?.content ?? '');
  const scene = user.match(/^- ([^(\n]+) \(/m)?.[1]?.trim() ?? '';
  const result = user.match(/outcome ([a-z ]+) \(success chance was (\d+)%\)/);
  const action = user.match(/Player action: "([^"]{0,80})/)?.[1] ?? '';
  const turn = (user.match(/^Player action:/gm) ?? []).length + (user.match(/^Narrator:/gm) ?? []).length;
  return JSON.stringify({
    narration: result
      ? `Lokale KI erzählt: Du versuchst „${action}“ – ${result[1]} (${result[2]} %).${scene ? ` ${scene} beobachtet dich genau.` : ''}`
      : `Lokale KI erzählt: Der Abend beginnt.${scene ? ` ${scene} wartet bereits auf dich.` : ''}`,
    dialogue: scene ? [{ speaker: scene, text: `Wir müssen reden (${turn}).` }] : [],
    location: 'Restaurant Da Greco',
    present: scene ? [scene] : [],
    facts: [],
    suggestions: [
      { kind: 'smart', text: `Mit ${scene || 'allen'} in Ruhe die Lage besprechen ${turn}`, category: 'talk', target: scene },
      { kind: 'alternative', text: `Die Bücher des Restaurants prüfen ${turn}`, category: 'investigate', target: '' },
      { kind: 'risky', text: `${scene || 'Den Gegner'} offen bedrohen ${turn}`, category: 'threaten', target: scene },
      { kind: 'surprising', text: `Eine Feier für alle ausrichten ${turn}`, category: 'public', target: '' },
    ],
  });
}

function replyFor(body) {
  const last = String(body.messages?.at(-1)?.content ?? '').slice(0, 60);
  const format = body.format;
  if (format && typeof format === 'object' && format.properties?.characters) {
    if (format.properties.playerRole) return JSON.stringify({ title: 'Palermo bei Nacht', playerName: '', playerRole: '', setting: '', characters: [] });
    return JSON.stringify(worldDraft(format.properties.characters.minItems ?? 3));
  }
  if (format && typeof format === 'object' && format.properties?.narration) return narration(body);
  if (format && typeof format === 'object' && format.properties?.visible) {
    return JSON.stringify({ action: 'two people talking quietly at a candle-lit table', location: 'a small restaurant', mood: 'tense', visible: [] });
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
