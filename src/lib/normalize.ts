import { rupeesToPaise } from './money';
import type { Exchange, Segment, TradeInput } from '../types/trade';

const SEGMENTS: readonly Segment[] = [
  'equity_delivery',
  'equity_intraday',
  'futures',
  'options',
];

function parseAmountString(input: string): number {
  const cleaned: string = input
    .replace(/INR/gi, '')
    .replace(/₹/g, '')
    .replace(/[\s,]/g, '');

  if (cleaned.length === 0) {
    throw new TypeError('Amount must contain a numeric value.');
  }
  if (cleaned.startsWith('-')) {
    throw new RangeError('Amount must be non-negative.');
  }
  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) {
    throw new TypeError('Amount must be a valid numeric value.');
  }

  const amount: number = Number(cleaned);
  if (!Number.isFinite(amount)) {
    throw new RangeError('Amount must be finite.');
  }
  return amount;
}

export function normalizeAmountToPaise(input: unknown): number {
  let amount: number;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new TypeError('Amount must be finite.');
    }
    if (input < 0) {
      throw new RangeError('Amount must be non-negative.');
    }
    amount = input;
  } else if (typeof input === 'string') {
    amount = parseAmountString(input.trim());
  } else {
    throw new TypeError('Amount must be a number or string.');
  }

  return rupeesToPaise(amount);
}

export function normalizeQuantity(input: unknown): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || !Number.isInteger(input)) {
      throw new TypeError('Quantity must be a finite integer.');
    }
    if (input <= 0) {
      throw new RangeError('Quantity must be positive.');
    }
    if (!Number.isSafeInteger(input)) {
      throw new RangeError('Quantity exceeds the safe integer range.');
    }
    return input;
  }

  if (typeof input !== 'string') {
    throw new TypeError('Quantity must be a positive integer or numeric string.');
  }

  const cleaned: string = input.replace(/[\s,]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) {
    throw new TypeError('Quantity must be a positive integer.');
  }

  const quantity: bigint = BigInt(cleaned.replace(/^\+/, ''));
  if (quantity <= 0n) {
    throw new RangeError('Quantity must be positive.');
  }
  if (quantity > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Quantity exceeds the safe integer range.');
  }
  return Number(quantity);
}

export function normalizeSegment(input: unknown): Segment {
  if (typeof input !== 'string') {
    throw new TypeError('Segment must be a string.');
  }

  const normalized: string = input.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!SEGMENTS.includes(normalized as Segment)) {
    throw new RangeError(`Unsupported segment: ${input}.`);
  }
  return normalized as Segment;
}

export function normalizeExchange(input: unknown): Exchange {
  if (typeof input !== 'string') {
    throw new TypeError('Exchange must be a string.');
  }

  const normalized: string = input.trim().toUpperCase();
  if (normalized !== 'NSE' && normalized !== 'BSE') {
    throw new RangeError(`Unsupported exchange: ${input}.`);
  }
  return normalized;
}

export function normalizeTradeInput(raw: Record<string, unknown>): TradeInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('Trade input must be an object.');
  }

  if (typeof raw.brokerId !== 'string' || raw.brokerId.trim().length === 0) {
    throw new TypeError('Broker ID must be a non-empty string.');
  }

  return {
    brokerId: raw.brokerId.trim(),
    segment: normalizeSegment(raw.segment),
    exchange: normalizeExchange(raw.exchange),
    buyPricePaise: normalizeAmountToPaise(raw.buyPrice),
    sellPricePaise: normalizeAmountToPaise(raw.sellPrice),
    quantity: normalizeQuantity(raw.quantity),
    lotSize: raw.lotSize == null ? 1 : normalizeQuantity(raw.lotSize),
  };
}
