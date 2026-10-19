export interface QuoteFingerprintInput {
  readonly buyPricePaise: number;
  readonly exchange: string;
  readonly lotSize: number;
  readonly quantity: number;
  readonly segment: string;
  readonly sellPricePaise: number;
}

function isQuoteFingerprintInput(input: unknown): input is QuoteFingerprintInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const candidate: Record<string, unknown> = input as Record<string, unknown>;
  return typeof candidate.buyPricePaise === 'number'
    && typeof candidate.exchange === 'string'
    && typeof candidate.lotSize === 'number'
    && typeof candidate.quantity === 'number'
    && typeof candidate.segment === 'string'
    && typeof candidate.sellPricePaise === 'number';
}

export async function createQuoteFingerprint(
  input: QuoteFingerprintInput | Record<string, unknown>,
): Promise<string> {
  const cryptoApi: Crypto | undefined = globalThis.crypto;
  if (cryptoApi === undefined || cryptoApi.subtle === undefined) {
    throw new Error('Web Crypto SHA-256 is unavailable.');
  }
  if (!isQuoteFingerprintInput(input)) {
    throw new TypeError('Quote fingerprint input is invalid.');
  }

  const canonicalInput = {
    b: input.buyPricePaise,
    e: input.exchange,
    l: input.lotSize,
    q: input.quantity,
    s: input.segment,
    x: input.sellPricePaise,
  };
  const serialized: string = JSON.stringify(canonicalInput);
  const encoded: Uint8Array = new TextEncoder().encode(serialized);
  const digest: ArrayBuffer = await cryptoApi.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte: number) => byte.toString(16).padStart(2, '0')).join('');
}
