import { describe, expect, it, beforeEach, vi } from 'vitest';
import worker, { type Env } from '../src/worker';
import type { RateRegistry } from '../src/types';

class MemoryKv {
  private readonly values = new Map<string, string>();
  public async get<T>(key: string, type: 'json'): Promise<T | null> {
    const value: string | undefined = this.values.get(key);
    return value === undefined ? null : JSON.parse(value) as T;
  }
  public async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

const cachedResponses = new Map<string, Response>();
const cache = {
  match: vi.fn(async (request: Request): Promise<Response | undefined> => cachedResponses.get(request.url)),
  put: vi.fn(async (request: Request, response: Response): Promise<void> => {
    cachedResponses.set(request.url, response);
  }),
};

const env: Env = { REGISTRY_KV: new MemoryKv() as unknown as KVNamespace, ALLOWED_ORIGIN: 'https://tradesetu.pages.dev' };
const input = { segment: 'Equity Delivery', exchange: 'NSE', buyPrice: '₹1,000.50', sellPrice: 'INR 1,050', quantity: '10', brokerId: 'zerodha' };

function request(body: unknown = input, init: RequestInit = {}): Request {
  return new Request('https://api.example/quote', {
    method: 'POST',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: env.ALLOWED_ORIGIN,
      ...(init.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  cachedResponses.clear();
  cache.match.mockClear();
  cache.put.mockClear();
  vi.stubGlobal('caches', { default: cache });
});

describe('Cloudflare edge worker', () => {
  it('returns 204 for OPTIONS', async () => expect((await worker.fetch(new Request('https://api.example', { method: 'OPTIONS', headers: { Origin: env.ALLOWED_ORIGIN } }), env)).status).toBe(204));
  it('rejects GET with 405', async () => expect((await worker.fetch(new Request('https://api.example', { method: 'GET' }), env)).status).toBe(405));
  it('rejects non-JSON content', async () => expect((await worker.fetch(request(input, { headers: { 'Content-Type': 'text/plain' } }), env)).status).toBe(415));
  it('rejects invalid JSON', async () => expect((await worker.fetch(new Request('https://api.example', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), env)).status).toBe(400));
  it('rejects oversized bodies', async () => expect((await worker.fetch(request('x'.repeat(8200)), env)).status).toBe(413));
  it('rejects invalid segment with 422', async () => expect((await worker.fetch(request({ ...input, segment: 'crypto' }), env)).status).toBe(422));
  it('rejects invalid exchange with 422', async () => expect((await worker.fetch(request({ ...input, exchange: 'LSE' }), env)).status).toBe(422));
  it('rejects missing broker ID with 422', async () => expect((await worker.fetch(request({ ...input, brokerId: '' }), env)).status).toBe(422));
  it('returns a valid statutory quote', async () => {
    const response: Response = await worker.fetch(request(), env);
    const body = await response.json() as { fingerprint: string; registryVersion: string };
    expect(response.status).toBe(200);
    expect(body.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(body.registryVersion).toBe('v2026.10.19');
  });
  it('produces identical fingerprints for identical requests', async () => {
    const first = await (await worker.fetch(request(), env)).json() as { fingerprint: string };
    cachedResponses.clear();
    const second = await (await worker.fetch(request(), env)).json() as { fingerprint: string };
    expect(first.fingerprint).toBe(second.fingerprint);
  });
  it('returns 304 for a matching ETag', async () => {
    const first: Response = await worker.fetch(request(), env);
    const etag: string | null = first.headers.get('ETag');
    const response: Response = await worker.fetch(request(input, { headers: { 'If-None-Match': etag ?? '' } }), env);
    expect(response.status).toBe(304);
  });
  it('returns cache hits and stores cache misses', async () => {
    const first: Response = await worker.fetch(request(), env);
    expect(cache.put).toHaveBeenCalled();
    const second: Response = await worker.fetch(request(), env);
    expect(cache.match).toHaveBeenCalled();
    expect(await second.text()).toBe(await first.text());
  });
  it('sets CORS for disallowed and allowed origins', async () => {
    const denied: Response = await worker.fetch(request(input, { headers: { Origin: 'https://other.example' } }), env);
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBe('null');
    const allowed: Response = await worker.fetch(request(), env);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
  });
  it('sets required security headers', async () => {
    const response: Response = await worker.fetch(request(), env);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
  });
  it('does not mutate the input request body', async () => {
    const original: Request = request();
    const body: string = await original.clone().text();
    await worker.fetch(original, env);
    expect(await original.clone().text()).toBe(body);
  });
});
