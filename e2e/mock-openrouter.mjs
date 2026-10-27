// Lokaler Nachbau der OpenRouter-API für Ende-zu-Ende-Tests (keine echten KI-Aufrufe, keine Kosten).
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 3198);
const VALID_KEY = 'sk-or-v1-e2e-mock-key-0123456789';

const models = [
  { id: 'mock/free-chat', name: 'Mock Free Chat', context_length: 8192, pricing: { prompt: '0', completion: '0' } },
  { id: 'mock/paid-chat', name: 'Mock Paid Chat', context_length: 32768, pricing: { prompt: '0.000001', completion: '0.000002' } },
];

const server = createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const authorized = req.headers.authorization === `Bearer ${VALID_KEY}`;
  if (req.method === 'GET' && req.url === '/api/v1/models') return send(200, { data: models });
  if (req.method === 'GET' && req.url === '/api/v1/key') return authorized ? send(200, { data: { label: 'mock' } }) : send(401, { error: { message: 'Invalid key' } });
  if (req.method === 'POST' && req.url === '/api/v1/chat/completions') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!authorized) return send(401, { error: { message: 'Invalid key', code: 401 } });
      const body = JSON.parse(raw || '{}');
      const last = body.messages?.at(-1)?.content ?? '';
      send(200, {
        model: body.model,
        choices: [{ message: { content: `KI-Antwort (${body.model}): Du schreibst „${String(last).slice(0, 60)}“.` } }],
        usage: { prompt_tokens: 200, completion_tokens: 40, cost: 0 },
      });
    });
    return;
  }
  send(404, { error: { message: 'not found' } });
});
server.listen(port, '127.0.0.1');
