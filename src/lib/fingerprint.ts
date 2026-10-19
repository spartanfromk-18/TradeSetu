export async function createQuoteFingerprint(
  input: Record<string, unknown>,
): Promise<string> {
  const cryptoApi: Crypto | undefined = globalThis.crypto;
  if (cryptoApi === undefined || cryptoApi.subtle === undefined) {
    throw new Error('Web Crypto SHA-256 is unavailable.');
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
