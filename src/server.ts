import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateAddress } from './address-validator.js';
import { createRateLimiter } from './rate-limiter.js';
import { createRPCClient } from './rpc-client.js';
import { createBalanceCache } from './cache.js';
import { sanitizeError } from './error-sanitizer.js';
import { extractIP } from './client-identifier.js';
import { InvalidAddressError } from './errors.js';

export interface ServerDeps {
  rpcClient: ReturnType<typeof createRPCClient>;
  rateLimiter?: ReturnType<typeof createRateLimiter>;
  cache?: ReturnType<typeof createBalanceCache>;
  trustedProxyCount?: number;
}

function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  setSecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function formatEth(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  const fractionStr = fraction.toString().padStart(18, '0').replace(/0+$/, '');
  if (fractionStr === '') return whole.toString() + '.0';
  return `${whole}.${fractionStr}`;
}

export function createApp(deps: ServerDeps) {
  const {
    rpcClient,
    rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 }),
    cache = createBalanceCache({ ttlMs: 30_000 }),
    trustedProxyCount = 1,
  } = deps;

  async function handleBalance(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const clientIP = extractIP(req, trustedProxyCount);

    const allowed = await rateLimiter.consume(clientIP);
    const remaining = await rateLimiter.remaining(clientIP);
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      sendJSON(res, 429, {
        error: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter: 30,
      });
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const rawAddress = url.searchParams.get('address');

    let address: string;
    try {
      address = validateAddress(rawAddress);
    } catch (err) {
      if (err instanceof InvalidAddressError) {
        sendJSON(res, 400, {
          error: 'INVALID_ADDRESS',
          message: 'Invalid Ethereum address format',
        });
        return;
      }
      throw err;
    }

    const cached = await cache.get(address);
    if (cached) {
      sendJSON(res, 200, {
        address,
        balance: cached.balance.toString(),
        balanceInEth: formatEth(cached.balance),
        cached: true,
      });
      return;
    }

    try {
      const balance = await rpcClient.getBalance(address);
      await cache.set(address, balance);
      sendJSON(res, 200, {
        address,
        balance: balance.toString(),
        balanceInEth: formatEth(balance),
        cached: false,
      });
    } catch (err) {
      const sanitized = sanitizeError(err as Error);
      sendJSON(res, sanitized.status, sanitized.body);
    }
  }

  async function serveStatic(res: ServerResponse, filename: string, contentType: string): Promise<void> {
    try {
      const filePath = join(new URL('.', import.meta.url).pathname, '..', 'public', filename);
      const content = await readFile(filePath, 'utf-8');
      setSecurityHeaders(res);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      sendJSON(res, 404, { error: 'NOT_FOUND', message: 'Not found' });
    }
  }

  function handler(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/balance') {
      handleBalance(req, res).catch(() => {
        sendJSON(res, 500, { error: 'INTERNAL_ERROR', message: 'Internal server error' });
      });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      serveStatic(res, 'index.html', 'text/html');
      return;
    }

    sendJSON(res, 404, { error: 'NOT_FOUND', message: 'Not found' });
  }

  return { handler };
}

// Standalone server
import 'dotenv/config';
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    console.error('RPC_URL environment variable is required');
    process.exit(1);
  }
  const rpcClient = createRPCClient({ rpcUrl });
  const app = createApp({ rpcClient });
  const server = createServer(app.handler);
  server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}
