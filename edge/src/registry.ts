import type { RateRegistry } from './types';

const REGISTRY_KEY = 'brokers_registry_v2026';
const REGISTRY_VERSION = 'v2026.10.19';

function fallbackRegistry(): RateRegistry {
  return {
    schemaVersion: '1.0.0',
    registryVersion: REGISTRY_VERSION,
    currency: 'INR',
    statutory: {
      gstRateBps: 1800,
      stt: {
        equity_delivery: { buyBps: 100, sellBps: 100 },
        equity_intraday: { buyBps: 0, sellBps: 25 },
        futures: { buyBps: 0, sellBps: 20 },
        options: { buyBps: 0, sellBps: 100, basis: 'PREMIUM' },
      },
      transactionCharges: {
        NSE: { equity_delivery: 3.25, equity_intraday: 3.25, futures: 1.73, options: 35.03 },
        BSE: { equity_delivery: 3.75, equity_intraday: 3.75, futures: 0, options: 0 },
      },
      sebiTurnoverFeeBps: 0.1,
      stampDuty: {
        equity_delivery: { buyBps: 15, sellBps: 0 },
        equity_intraday: { buyBps: 3, sellBps: 0 },
        futures: { buyBps: 2, sellBps: 0 },
        options: { buyBps: 3, sellBps: 0, basis: 'PREMIUM' },
      },
      dpCharges: {
        CDSL: { sellPerScripPaise: 1500, gstApplicable: true },
        NSDL: { sellPerScripPaise: 1500, gstApplicable: true },
      },
    },
    brokers: [],
  };
}

export async function getRegistry(kv: KVNamespace): Promise<RateRegistry> {
  const cached: RateRegistry | null = await kv.get<RateRegistry>(REGISTRY_KEY, 'json');
  if (cached !== null) {
    return cached;
  }
  const fallback: RateRegistry = fallbackRegistry();
  await kv.put(REGISTRY_KEY, JSON.stringify(fallback), { expirationTtl: 60 });
  return fallback;
}
