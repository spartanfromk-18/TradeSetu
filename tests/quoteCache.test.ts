import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuoteFingerprint } from '../src/lib/fingerprint';
import {
  clearQuoteCache,
  enforceQuoteLimit,
  getCachedQuote,
  pruneExpiredQuotes,
  putCachedQuote,
} from '../src/lib/quoteCache';
import type { ComputeResult } from '../src/types/trade';

const baseInput: Record<string, unknown> = {
  buyPricePaise: 10000,
  sellPricePaise: 10100,
  quantity: 10,
  lotSize: 1,
  segment: 'equity_delivery',
  exchange: 'NSE',
  brokerId: 'zerodha',
};

const result: ComputeResult = {
  brokerId: 'zerodha',
  brokerName: 'Zerodha',
  turnoverPaise: 201000,
  brokeragePaise: 2000,
  sttPaise: 2010,
  exchangeTransactionPaise: 65,
  sebiPaise: 21,
  stampDutyPaise: 30,
  gstPaise: 377,
  dpPaise: 1500,
  totalChargesPaise: 6003,
  breakevenPaise: 1201,
  netPnlPaise: -5003,
  breakdown: [],
};

async function fingerprintFor(input: Record<string, unknown> = baseInput): Promise<string> {
  return createQuoteFingerprint(input);
}

describe('quote fingerprint and cache', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    await new Promise<void>((resolve, reject) => {
      const request: IDBOpenDBRequest = indexedDB.open('tradesetu', 1);
      request.onsuccess = (): void => {
        request.result.close();
        const deleteRequest: IDBOpenDBRequest = indexedDB.deleteDatabase('tradesetu');
        deleteRequest.onsuccess = (): void => resolve();
        deleteRequest.onerror = (): void => reject(deleteRequest.error);
      };
      request.onerror = (): void => reject(request.error);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates stable lowercase SHA-256 fingerprints', async () => {
    const fingerprint: string = await fingerprintFor();
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprintFor()).toBe(fingerprint);
    expect(await fingerprintFor({ ...baseInput, brokerId: 'groww' })).toBe(fingerprint);
  });

  it('changes fingerprints for relevant normalized fields', async () => {
    const original: string = await fingerprintFor();
    expect(await fingerprintFor({ ...baseInput, buyPricePaise: 10001 })).not.toBe(original);
    expect(await fingerprintFor({ ...baseInput, quantity: 11 })).not.toBe(original);
    expect(await fingerprintFor({ ...baseInput, segment: 'futures' })).not.toBe(original);
  });

  it('returns null for a missing fingerprint', async () => {
    expect(await getCachedQuote('missing')).toBeNull();
  });

  it('stores and reads a valid quote before expiry', async () => {
    const fingerprint: string = await fingerprintFor();
    await putCachedQuote(fingerprint, 'v2026.10.19', result);
    const cached = await getCachedQuote(fingerprint);
    expect(cached?.fingerprint).toBe(fingerprint);
    expect(cached?.registryVersion).toBe('v2026.10.19');
    expect(cached?.result).toEqual(result);
    expect(cached?.expiresAt).toBeGreaterThan(cached?.createdAt ?? 0);
  });

  it('returns null after expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start: number = new Date('2026-10-19T00:00:00.000Z').getTime();
    vi.setSystemTime(start);
    const fingerprint: string = await fingerprintFor();
    await putCachedQuote(fingerprint, 'v2026.10.19', result);
    vi.setSystemTime(start + 24 * 60 * 60 * 1000);
    await expect(getCachedQuote(fingerprint)).resolves.toBeNull();
  });

  it('prunes expired records and returns the deleted count', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start: number = new Date('2026-10-19T00:00:00.000Z').getTime();
    vi.setSystemTime(start);
    const fingerprint: string = await fingerprintFor();
    await putCachedQuote(fingerprint, 'v2026.10.19', result);
    vi.setSystemTime(start + 24 * 60 * 60 * 1000);
    await expect(pruneExpiredQuotes()).resolves.toBe(1);
    await expect(getCachedQuote(fingerprint)).resolves.toBeNull();
  });

  it('keeps at most 500 records', async () => {
    for (let index = 0; index < 501; index += 1) {
      await putCachedQuote(`fingerprint-${index}`, 'v2026.10.19', result);
    }
    const finalFingerprint: string = await fingerprintFor();
    await putCachedQuote(finalFingerprint, 'v2026.10.19', result);
    const databaseRequest: IDBOpenDBRequest = indexedDB.open('tradesetu', 1);
    const count: number = await new Promise<number>((resolve, reject) => {
      databaseRequest.onsuccess = (): void => {
        const database: IDBDatabase = databaseRequest.result;
        const request: IDBRequest<number> = database
          .transaction('quotes', 'readonly')
          .objectStore('quotes')
          .count();
        request.onsuccess = (): void => {
          database.close();
          resolve(request.result);
        };
        request.onerror = (): void => reject(request.error);
      };
      databaseRequest.onerror = (): void => reject(databaseRequest.error);
    });
    expect(count).toBe(500);
  });

  it('clears all records', async () => {
    await putCachedQuote('one', 'v2026.10.19', result);
    await putCachedQuote('two', 'v2026.10.19', result);
    await clearQuoteCache();
    expect(await getCachedQuote('one')).toBeNull();
    expect(await getCachedQuote('two')).toBeNull();
  });

  it('fails safely when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(getCachedQuote('missing')).resolves.toBeNull();
    await expect(putCachedQuote('missing', 'v2026.10.19', result)).resolves.toBeUndefined();
    await expect(pruneExpiredQuotes()).resolves.toBe(0);
    await expect(enforceQuoteLimit()).resolves.toBeUndefined();
    await expect(clearQuoteCache()).resolves.toBeUndefined();
  });
});
