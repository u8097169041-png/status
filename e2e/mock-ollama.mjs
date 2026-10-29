// Lokaler Nachbau der Ollama-API für Ende-zu-Ende-Tests (kein echtes Modell, keine Downloads).
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 3196);

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
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      const last = String(body.messages?.at(-1)?.content ?? '').slice(0, 60);
      const content =
        body.format === 'json'
          ? JSON.stringify({ reply: `Lokale KI-Antwort: Du schreibst „${last}“.`, tone: 'warm' })
          : 'OK';
      send(200, { model: body.model, message: { role: 'assistant', content }, done: true, prompt_eval_count: 250, eval_count: 20 });
    });
    return;
  }
  send(404, { error: 'not found' });
});
server.listen(port, '127.0.0.1');
