import { createQuoteFingerprint } from './fingerprint';
import { normalizeTradeInput, type NormalizedTradeInput } from './normalize';
import { getRegistry } from './registry';
import type { RateRegistry, Segment } from './types';

export interface Env {
  readonly REGISTRY_KV: KVNamespace;
  readonly ALLOWED_ORIGIN: string;
}

const MAX_BODY_LENGTH = 8192;
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
};

function getEdgeCache(): Cache {
  return (caches as unknown as { readonly default: Cache }).default;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin: string = request.headers.get('Origin') ?? '';
  return {
    ...SECURITY_HEADERS,
    'Access-Control-Allow-Origin': origin === env.ALLOWED_ORIGIN ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, request: Request, env: Env, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, env), 'Content-Type': 'application/json', ...extra },
  });
}

function errorResponse(code: string, status: number, request: Request, env: Env): Response {
  return jsonResponse({ error: code }, status, request, env);
}

function chargeByBps(amountPaise: number, rateBps: number): number {
  const rateText: string = String(rateBps);
  const [whole, fraction = ''] = rateText.split('.');
  const numerator: bigint = BigInt(`${whole}${fraction}`);
  const rateDenominator: bigint = 10n ** BigInt(fraction.length);
  return Number((BigInt(amountPaise) * numerator) / (rateDenominator * 10000n));
}

function calculateQuote(input: NormalizedTradeInput, registry: RateRegistry): Record<string, unknown> {
  const buyTurnoverPaise: number = input.buyPricePaise * input.quantity;
  const sellTurnoverPaise: number = input.sellPricePaise * input.quantity;
  const turnoverPaise: number = buyTurnoverPaise + sellTurnoverPaise;
  const sttRate = registry.statutory.stt[input.segment];
  const transactionRate: number = registry.statutory.transactionCharges[input.exchange][input.segment];
  const stampRate = registry.statutory.stampDuty[input.segment];
  const sttPaise: number = chargeByBps(buyTurnoverPaise, sttRate.buyBps)
    + chargeByBps(sellTurnoverPaise, sttRate.sellBps);
  const exchangeTransactionPaise: number = chargeByBps(turnoverPaise, transactionRate);
  const sebiPaise: number = chargeByBps(turnoverPaise, registry.statutory.sebiTurnoverFeeBps);
  const stampDutyPaise: number = chargeByBps(buyTurnoverPaise, stampRate.buyBps)
    + chargeByBps(sellTurnoverPaise, stampRate.sellBps);
  const dpRate = registry.statutory.dpCharges.CDSL;
  const dpPaise: number = input.segment === 'equity_delivery' && sellTurnoverPaise > 0
    ? dpRate.sellPerScripPaise
    : 0;
  const gstBasePaise: number = exchangeTransactionPaise + sebiPaise
    + (dpRate.gstApplicable ? dpPaise : 0);
  const gstPaise: number = chargeByBps(gstBasePaise, registry.statutory.gstRateBps);
  const totalChargesPaise: number = sttPaise + exchangeTransactionPaise + sebiPaise
    + stampDutyPaise + gstPaise + dpPaise;
  return {
    segment: input.segment,
    exchange: input.exchange,
    quantity: input.quantity,
    buyTurnoverPaise,
    sellTurnoverPaise,
    turnoverPaise,
    statutoryCharges: {
      sttPaise,
      exchangeTransactionPaise,
      sebiPaise,
      stampDutyPaise,
      gstPaise,
      dpPaise,
    },
    totalChargesPaise,
    brokerComparisonRequired: true,
  };
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  const contentType: string = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (contentType !== 'application/json') {
    return errorResponse('UNSUPPORTED_MEDIA_TYPE', 415, request, env);
  }
  const bodyText: string = await request.clone().text();
  if (bodyText.length > MAX_BODY_LENGTH) {
    return errorResponse('PAYLOAD_TOO_LARGE', 413, request, env);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return errorResponse('INVALID_JSON', 400, request, env);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return errorResponse('INVALID_REQUEST', 400, request, env);
  }
  let input: NormalizedTradeInput;
  try {
    input = normalizeTradeInput(parsed as Record<string, unknown>);
  } catch {
    return errorResponse('VALIDATION_FAILED', 422, request, env);
  }
  const registry: RateRegistry = await getRegistry(env.REGISTRY_KV);
  const fingerprint: string = await createQuoteFingerprint(input);
  const etag: string = `"${fingerprint}-${registry.registryVersion}"`;
  const headers: Record<string, string> = { ETag: etag };
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ...corsHeaders(request, env), ...headers } });
  }
  const cacheKey: Request = new Request(
    `https://quote-cache.internal/v1/quotes/${fingerprint}?registry=${encodeURIComponent(registry.registryVersion)}`,
  );
  const edgeCache: Cache = getEdgeCache();
  const cached: Response | undefined = await edgeCache.match(cacheKey);
  if (cached !== undefined) {
    const cachedHeaders: Headers = new Headers(cached.headers);
    for (const [name, value] of Object.entries(corsHeaders(request, env))) {
      cachedHeaders.set(name, value);
    }
    return new Response(cached.body, {
      status: cached.status,
      headers: cachedHeaders,
    });
  }
  const body = {
    fingerprint,
    registryVersion: registry.registryVersion,
    quote: calculateQuote(input, registry),
  };
  const response: Response = jsonResponse(body, 200, request, env, headers);
  await edgeCache.put(cacheKey, response.clone());
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== 'POST') {
      return errorResponse('METHOD_NOT_ALLOWED', 405, request, env);
    }
    try {
      return await handlePost(request, env);
    } catch {
      return errorResponse('BAD_REQUEST', 400, request, env);
    }
  },
};
