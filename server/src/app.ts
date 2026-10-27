import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AppContext } from './context';
import { AppError } from './lib/errors';
import { aiRoutes } from './routes/ai';
import { characterRoutes } from './routes/characters';
import { coreRoutes } from './routes/core';
import { feedRoutes } from './routes/feed';
import { worldRoutes } from './routes/worlds';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface AppOptions {
  /** Ordner mit dem gebauten Frontend (nur im Produktionsstart). */
  clientDir?: string | null;
  /** Zusätzlich erlaubte Hostnamen (z. B. für Zugriff im Heimnetz). */
  allowedHosts?: string[];
}

function hostnameOf(hostHeader: string | undefined): string {
  if (!hostHeader) return '';
  if (hostHeader.startsWith('[')) return hostHeader.slice(0, hostHeader.indexOf(']') + 1).toLowerCase();
  return hostHeader.split(':')[0].toLowerCase();
}

/** Einfache Ratenbegrenzung pro Prozess für teure Endpunkte (KI, Simulation). */
function rateLimit(maxPerMinute: number) {
  const hits: number[] = [];
  return (_req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    while (hits.length && hits[0] < now - 60_000) hits.shift();
    if (hits.length >= maxPerMinute) {
      next(new AppError(429, 'too_many_requests', 'Zu viele Anfragen in kurzer Zeit. Bitte kurz warten.'));
      return;
    }
    hits.push(now);
    next();
  };
}

export function createApp(ctx: AppContext, options: AppOptions = {}): express.Express {
  const app = express();
  const allowedHosts = new Set([...LOOPBACK_HOSTS, ...(options.allowedHosts ?? []).map((h) => h.toLowerCase())]);
  app.disable('x-powered-by');
  app.set('etag', false);

  // Sicherheits-Header für alle Antworten.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; " +
        "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
    next();
  });

  // Schutz vor DNS-Rebinding: nur bekannte Hostnamen akzeptieren.
  app.use((req, _res, next) => {
    if (!allowedHosts.has(hostnameOf(req.headers.host))) {
      next(new AppError(403, 'forbidden_host', 'Unbekannter Host.'));
      return;
    }
    next();
  });

  // CSRF-Schutz für die API: Schreibende Anfragen benötigen einen eigenen Header und eine erlaubte Herkunft.
  app.use('/api', (req, _res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    if (req.headers['x-socialverse'] !== '1') {
      next(new AppError(403, 'csrf', 'Anfrage ohne gültige Kennung abgelehnt.'));
      return;
    }
    const origin = req.headers.origin;
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).hostname.toLowerCase();
      } catch {
        originHost = '';
      }
      if (!allowedHosts.has(originHost)) {
        next(new AppError(403, 'csrf', 'Anfrage von fremder Herkunft abgelehnt.'));
        return;
      }
    }
    next();
  });

  app.use('/api', express.json({ limit: '200kb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const expensive = rateLimit(40);
  app.use('/api/chats/:id/messages', expensive);
  app.use('/api/worlds/generate', expensive);
  app.use('/api/worlds/:id/simulate', expensive);
  app.use('/api/worlds/:id/events', expensive);
  app.use('/api/ai/test', expensive);

  app.use('/api', coreRoutes(ctx));
  app.use('/api', feedRoutes(ctx));
  app.use('/api', characterRoutes(ctx));
  app.use('/api', worldRoutes(ctx));
  app.use('/api', aiRoutes(ctx));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'not_found', 'Unbekannter API-Endpunkt.')));

  if (options.clientDir && existsSync(resolve(options.clientDir, 'index.html'))) {
    const clientDir = options.clientDir;
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    // Single-Page-App: alle übrigen GET-Anfragen liefern index.html.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(resolve(clientDir, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
      return;
    }
    const e = error as { type?: string; status?: number; message?: string };
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'invalid_json', message: 'Ungültiges JSON im Anfragekörper.' } });
      return;
    }
    if (e?.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'payload_too_large', message: 'Die Anfrage ist zu groß.' } });
      return;
    }
    console.error('[server] Unerwarteter Fehler:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Interner Fehler. Details stehen im Server-Log.' } });
  });

  return app;
}
