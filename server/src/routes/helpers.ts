import type { Request } from 'express';

/** Liest einen einfachen String-Query-Parameter (begrenzte Länge). */
export function q(req: Request, name: string, maxLength = 120): string | undefined {
  const value = req.query[name];
  if (typeof value !== 'string' || value === '') return undefined;
  return value.slice(0, maxLength);
}

export function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value.slice(0, 120) : '';
}
