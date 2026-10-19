import { describe, expect, it } from 'vitest';
import {
  normalizeAmountToPaise,
  normalizeExchange,
  normalizeQuantity,
  normalizeSegment,
  normalizeTradeInput,
} from '../src/lib/normalize';

describe('input normalization', () => {
  it('normalizes supported currency formats to paise', () => {
    expect(normalizeAmountToPaise(100)).toBe(10000);
    expect(normalizeAmountToPaise('₹1,000.50')).toBe(100050);
    expect(normalizeAmountToPaise('INR 999.99')).toBe(99999);
    expect(normalizeAmountToPaise('1,00,000')).toBe(10000000);
  });

  it('normalizes positive quantities', () => {
    expect(normalizeQuantity('1,000')).toBe(1000);
    expect(normalizeQuantity(25)).toBe(25);
  });

  it('normalizes segment variants', () => {
    expect(normalizeSegment('Equity Delivery')).toBe('equity_delivery');
    expect(normalizeSegment('equity-delivery')).toBe('equity_delivery');
  });

  it('normalizes exchange variants', () => {
    expect(normalizeExchange('nse')).toBe('NSE');
    expect(normalizeExchange('BSE')).toBe('BSE');
  });

  it('returns a fully normalized trade input', () => {
    expect(normalizeTradeInput({
      segment: 'Equity Delivery',
      exchange: 'nse',
      buyPrice: '₹1,000.50',
      sellPrice: 'INR 1,050',
      quantity: '1,000',
      brokerId: ' zerodha ',
    })).toEqual({
      segment: 'equity_delivery',
      exchange: 'NSE',
      buyPricePaise: 100050,
      sellPricePaise: 105000,
      quantity: 1000,
      lotSize: 1,
      brokerId: 'zerodha',
    });
  });

  it('defaults a missing lot size to one', () => {
    const result = normalizeTradeInput({
      segment: 'futures',
      exchange: 'BSE',
      buyPrice: 100,
      sellPrice: 101,
      quantity: 2,
      brokerId: 'broker-id',
      lotSize: null,
    });
    expect(result.lotSize).toBe(1);
  });

  it('rejects invalid inputs', () => {
    expect(() => normalizeAmountToPaise(-1)).toThrow();
    expect(() => normalizeAmountToPaise('abc')).toThrow();
    expect(() => normalizeQuantity(0)).toThrow();
    expect(() => normalizeQuantity(1.5)).toThrow();
    expect(() => normalizeSegment('crypto')).toThrow();
    expect(() => normalizeExchange('Binance')).toThrow();
    expect(() => normalizeTradeInput({})).toThrow();
  });
});
