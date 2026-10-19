import type { Exchange, Segment } from './types';

export interface NormalizedTradeInput {
  readonly segment: Segment;
  readonly exchange: Exchange;
  readonly buyPricePaise: number;
  readonly sellPricePaise: number;
  readonly quantity: number;
  readonly lotSize: number;
  readonly brokerId: string;
}

function amountToPaise(input: unknown, name: string): number {
  const value: number = typeof input === 'number'
    ? input
    : typeof input === 'string'
      ? parseAmount(input)
      : Number.NaN;
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite amount.`);
  }
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative.`);
  }
  const paise: number = Math.round(value * 100);
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`${name} exceeds the safe paise range.`);
  }
  return paise;
}

function parseAmount(input: string): number {
  const cleaned: string = input.trim().replace(/INR/gi, '').replace(/₹/g, '').replace(/[\s,]/g, '');
  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) {
    return Number.NaN;
  }
  return Number(cleaned);
}

function positiveInteger(input: unknown, name: string): number {
  const cleaned: string = typeof input === 'string' ? input.replace(/[\s,]/g, '') : String(input);
  if (!/^\+?\d+$/.test(cleaned)) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
  const value: number = Number(cleaned);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return value;
}

export function normalizeTradeInput(raw: Record<string, unknown>): NormalizedTradeInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('Trade input must be an object.');
  }
  if (typeof raw.brokerId !== 'string' || raw.brokerId.trim().length === 0) {
    throw new TypeError('Broker ID must be a non-empty string.');
  }
  if (typeof raw.segment !== 'string') {
    throw new TypeError('Segment must be a string.');
  }
  const segmentValue: string = raw.segment.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['equity_delivery', 'equity_intraday', 'futures', 'options'].includes(segmentValue)) {
    throw new RangeError(`Unsupported segment: ${raw.segment}.`);
  }
  if (typeof raw.exchange !== 'string') {
    throw new TypeError('Exchange must be a string.');
  }
  const exchangeValue: string = raw.exchange.trim().toUpperCase();
  if (exchangeValue !== 'NSE' && exchangeValue !== 'BSE') {
    throw new RangeError(`Unsupported exchange: ${raw.exchange}.`);
  }
  return {
    segment: segmentValue as Segment,
    exchange: exchangeValue as Exchange,
    buyPricePaise: amountToPaise(raw.buyPrice, 'Buy price'),
    sellPricePaise: amountToPaise(raw.sellPrice, 'Sell price'),
    quantity: positiveInteger(raw.quantity, 'Quantity'),
    lotSize: raw.lotSize == null ? 1 : positiveInteger(raw.lotSize, 'Lot size'),
    brokerId: raw.brokerId.trim(),
  };
}
