import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[Error]', err);

  if (res.headersSent) return;

  if (err instanceof Error) {
    const status = (err as NodeJS.ErrnoException & { status?: number }).status ?? 500;
    res.status(status).json({
      success: false,
      error: status < 500 ? err.message : 'Internal server error',
    });
    return;
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: 'Route not found' });
}
