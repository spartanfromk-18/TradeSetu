import type { ComputeResult } from '../types/trade';

const DB_NAME = 'tradesetu';
const DB_VERSION = 1;
const STORE_NAME = 'quotes';
const MAX_RECORDS = 500;
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedQuote {
  readonly fingerprint: string;
  readonly registryVersion: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly result: ComputeResult;
}

function reportUnavailable(): void {
  console.warn('TradeSetu quote cache is unavailable.');
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (): void => {
      const database: IDBDatabase = request.result;
      const store: IDBObjectStore = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: 'fingerprint' });
      if (!store.indexNames.contains('expiresAt')) {
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
      if (!store.indexNames.contains('createdAt')) {
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('Unable to open quote cache.'));
  });
}

function completeTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = (): void => resolve();
    transaction.onerror = (): void => reject(transaction.error ?? new Error('Quote cache transaction failed.'));
    transaction.onabort = (): void => reject(new Error('Quote cache transaction was aborted.'));
  });
}

export async function getCachedQuote(fingerprint: string): Promise<CachedQuote | null> {
  try {
    const database: IDBDatabase = await openDatabase();
    const transaction: IDBTransaction = database.transaction(STORE_NAME, 'readonly');
    const request: IDBRequest<CachedQuote | undefined> = transaction
      .objectStore(STORE_NAME)
      .get(fingerprint);
    const record: CachedQuote | undefined = await new Promise<CachedQuote | undefined>((resolve, reject) => {
      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => reject(request.error ?? new Error('Unable to read quote cache.'));
    });
    database.close();
    if (record === undefined || record.expiresAt <= Date.now()) {
      return null;
    }
    return record;
  } catch (error: unknown) {
    reportUnavailable();
    return null;
  }
}

export async function putCachedQuote(
  fingerprint: string,
  registryVersion: string,
  result: ComputeResult,
): Promise<void> {
  try {
    const database: IDBDatabase = await openDatabase();
    const createdAt: number = Date.now();
    const record: CachedQuote = {
      fingerprint,
      registryVersion,
      createdAt,
      expiresAt: createdAt + RECORD_TTL_MS,
      result,
    };
    const transaction: IDBTransaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await completeTransaction(transaction);
    database.close();
    await pruneExpiredQuotes();
    await enforceQuoteLimit();
  } catch (error: unknown) {
    reportUnavailable();
  }
}

export async function pruneExpiredQuotes(): Promise<number> {
  try {
    const database: IDBDatabase = await openDatabase();
    const transaction: IDBTransaction = database.transaction(STORE_NAME, 'readwrite');
    const store: IDBObjectStore = transaction.objectStore(STORE_NAME);
    const index: IDBIndex = store.index('expiresAt');
    const request: IDBRequest<IDBCursorWithValue | null> = index.openCursor(
      IDBKeyRange.upperBound(Date.now()),
    );
    let deletedCount: number = 0;
    request.onsuccess = (): void => {
      const cursor: IDBCursorWithValue | null = request.result;
      if (cursor === null) {
        return;
      }
      cursor.delete();
      deletedCount += 1;
      cursor.continue();
    };
    await completeTransaction(transaction);
    database.close();
    return deletedCount;
  } catch (error: unknown) {
    reportUnavailable();
    return 0;
  }
}

export async function enforceQuoteLimit(): Promise<void> {
  try {
    const database: IDBDatabase = await openDatabase();
    const transaction: IDBTransaction = database.transaction(STORE_NAME, 'readwrite');
    const store: IDBObjectStore = transaction.objectStore(STORE_NAME);
    const countRequest: IDBRequest<number> = store.count();
    countRequest.onsuccess = (): void => {
      let excess: number = countRequest.result - MAX_RECORDS;
      if (excess <= 0) {
        return;
      }
      const cursorRequest: IDBRequest<IDBCursorWithValue | null> = store
        .index('createdAt')
        .openCursor();
      cursorRequest.onsuccess = (): void => {
        const cursor: IDBCursorWithValue | null = cursorRequest.result;
        if (cursor === null || excess <= 0) {
          return;
        }
        cursor.delete();
        excess -= 1;
        cursor.continue();
      };
    };
    await completeTransaction(transaction);
    database.close();
  } catch (error: unknown) {
    reportUnavailable();
  }
}

export async function clearQuoteCache(): Promise<void> {
  try {
    const database: IDBDatabase = await openDatabase();
    const transaction: IDBTransaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    await completeTransaction(transaction);
    database.close();
  } catch (error: unknown) {
    reportUnavailable();
  }
}
