import type { NormalizedTradeInput } from './normalize';

export async function createQuoteFingerprint(input: NormalizedTradeInput): Promise<string> {
  const canonical = {
    b: input.buyPricePaise,
    e: input.exchange,
    l: input.lotSize,
    q: input.quantity,
    s: input.segment,
    x: input.sellPricePaise,
  };
  const encoded: Uint8Array = new TextEncoder().encode(JSON.stringify(canonical));
  const digest: ArrayBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte: number) => byte.toString(16).padStart(2, '0')).join('');
}
