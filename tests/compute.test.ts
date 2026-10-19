import { describe, expect, it } from 'vitest';
import { brokerRegistry, computeAllBrokers, computeQuote } from '../src/lib/compute';
import type { TradeInput } from '../src/types/trade';

const deliveryInput: TradeInput = {
  brokerId: 'zerodha',
  segment: 'equity_delivery',
  exchange: 'NSE',
  buyPricePaise: 10000,
  sellPricePaise: 10100,
  quantity: 10,
  lotSize: 1,
};

function inputFor(segment: TradeInput['segment']): TradeInput {
  return {
    ...deliveryInput,
    segment,
    buyPricePaise: segment === 'options' ? 5000 : 10000,
    sellPricePaise: segment === 'options' ? 6000 : 10100,
  };
}

describe('deterministic compute kernel', () => {
  it('computes an equity delivery quote from the registry', () => {
    const result = computeQuote(deliveryInput);
    expect(result.turnoverPaise).toBe(201000);
    expect(result.brokeragePaise).toBe(2000);
    expect(result.totalChargesPaise).toBeGreaterThan(0);
    expect(result.netPnlPaise).toBe(1000 - result.totalChargesPaise);
    expect(result.breakevenPaise).toBe(Math.ceil((result.totalChargesPaise * 2) / deliveryInput.quantity));
    expect(result.breakdown.map((item) => item.label)).toEqual([
      'Brokerage',
      'STT',
      'Exchange transaction charges',
      'SEBI turnover fee',
      'Stamp duty',
      'GST',
      'DP charges',
    ]);
  });

  it('charges intraday STT on the sell side only', () => {
    const result = computeQuote(inputFor('equity_intraday'));
    const rate = brokerRegistry.statutory.stt.equity_intraday;
    expect(result.sttPaise).toBe(Math.floor((101000 * rate.sellBps) / 10000));
  });

  it('charges futures STT on the sell side only', () => {
    const result = computeQuote(inputFor('futures'));
    const rate = brokerRegistry.statutory.stt.futures;
    expect(result.sttPaise).toBe(Math.floor((101000 * rate.sellBps) / 10000));
  });

  it('calculates options STT on sell premium', () => {
    const result = computeQuote(inputFor('options'));
    const rate = brokerRegistry.statutory.stt.options;
    expect(result.sttPaise).toBe(Math.floor((60000 * rate.sellBps) / 10000));
  });

  it('applies DP charges only to equity delivery sells', () => {
    expect(computeQuote(inputFor('equity_delivery')).dpPaise).toBe(1500);
    expect(computeQuote(inputFor('equity_intraday')).dpPaise).toBe(0);
    expect(computeQuote(inputFor('futures')).dpPaise).toBe(0);
    expect(computeQuote(inputFor('options')).dpPaise).toBe(0);
  });

  it('calculates GST on brokerage, exchange charges, and SEBI fee', () => {
    const result = computeQuote(inputFor('equity_intraday'));
    const basePaise = result.brokeragePaise
      + result.exchangeTransactionPaise
      + result.sebiPaise;
    const expected = Math.floor((basePaise * brokerRegistry.statutory.gstBps) / 10000);
    expect(result.gstPaise).toBe(expected);
  });

  it('returns all brokers sorted by total charges', () => {
    const results = computeAllBrokers(deliveryInput);
    expect(results).toHaveLength(brokerRegistry.brokers.length);
    expect(results.map((result) => result.totalChargesPaise)).toEqual(
      [...results]
        .sort((left, right) => left.totalChargesPaise - right.totalChargesPaise)
        .map((result) => result.totalChargesPaise),
    );
  });

  it('is deterministic', () => {
    expect(computeQuote(deliveryInput)).toEqual(computeQuote(deliveryInput));
  });

  it('rejects invalid trade inputs', () => {
    expect(() => computeQuote({ ...deliveryInput, brokerId: 'unknown' })).toThrow();
    expect(() => computeQuote({ ...deliveryInput, quantity: 0 })).toThrowError(RangeError);
    expect(() => computeQuote({ ...deliveryInput, buyPricePaise: -1 })).toThrowError(RangeError);
    expect(() => computeQuote({ ...deliveryInput, sellPricePaise: -1 })).toThrowError(RangeError);
  });

  it('keeps total charges equal to all charge components', () => {
    for (const result of computeAllBrokers(deliveryInput)) {
      expect(result.totalChargesPaise).toBe(
        result.brokeragePaise
          + result.sttPaise
          + result.exchangeTransactionPaise
          + result.sebiPaise
          + result.stampDutyPaise
          + result.gstPaise
          + result.dpPaise,
      );
    }
  });
});
