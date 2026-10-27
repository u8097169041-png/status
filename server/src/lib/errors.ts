export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, 'not_found', `${what} wurde nicht gefunden.`);
export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const forbidden = (message: string) => new AppError(403, 'forbidden', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
