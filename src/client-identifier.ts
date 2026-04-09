import type { IncomingMessage } from 'node:http';

export function extractIP(req: IncomingMessage, trustedProxyCount: number): string {
  const socketIP = req.socket.remoteAddress ?? '127.0.0.1';
  const xff = req.headers['x-forwarded-for'];

  if (!xff || xff === '') return socketIP;

  const header = Array.isArray(xff) ? xff[0] : xff;
  if (!header || header.trim() === '') return socketIP;

  const parts = header.split(',').map(s => s.trim()).filter(s => s.length > 0);
  if (parts.length === 0) return socketIP;

  const index = parts.length - trustedProxyCount;
  if (index < 0) return parts[0];
  return parts[index];
}
