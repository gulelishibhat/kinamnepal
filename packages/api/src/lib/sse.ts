import type { Response } from 'express';

// ─── SSE client registry ──────────────────────────────────────────────────────
const clients = new Map<string, Response>();

export function registerSseClient(adminId: string, res: Response): void {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write('event: connected\ndata: {"status":"ok"}\n\n');

  clients.set(adminId, res);

  // Clean up on disconnect
  res.on('close', () => {
    clients.delete(adminId);
  });
}

export function broadcastToAdmins(eventName: string, data: unknown): void {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, res] of clients) {
    try {
      res.write(payload);
    } catch {
      // client disconnected mid-write; it will be cleaned up on 'close'
    }
  }
}

// Heartbeat to prevent proxy timeouts (every 25 seconds)
setInterval(() => {
  for (const [, res] of clients) {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      // ignore
    }
  }
}, 25_000);
