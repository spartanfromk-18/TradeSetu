import { describe, expect, it } from 'vitest';
import {
  MONEY_SCALE,
  addMicroPaise,
  clampMicroPaise,
  formatInr,
  fromMicroPaise,
  microPaiseToPaise,
  multiplyByRateBps,
  paiseToMicroPaise,
  paiseToRupees,
  rupeesToPaise,
  toMicroPaise,
} from '../src/lib/money';

describe('money engine', () => {
  it('uses the required micro-paise scale', () => {
    expect(MONEY_SCALE).toBe(10000);
  });

  it('converts rupees to micro-paise', () => {
    expect(toMicroPaise(1)).toBe(10000n);
    expect(toMicroPaise(0.01)).toBe(100n);
  });

  it('converts micro-paise to rupees', () => {
    expect(fromMicroPaise(10000n)).toBe(1);
  });

  it('converts paise to micro-paise', () => {
    expect(paiseToMicroPaise(1)).toBe(100n);
  });

  it('converts micro-paise to whole paise without rounding upward', () => {
    expect(microPaiseToPaise(199n)).toBe(1);
  });

  it('converts between rupees and paise using rounding', () => {
    expect(rupeesToPaise(10.555)).toBe(1056);
    expect(paiseToRupees(1056)).toBe(10.56);
  });

  it('formats paise as Indian currency', () => {
    const formatted: string = formatInr(1056);
    expect(formatted).toContain('₹');
    expect(formatted).toContain('10.56');
  });

  it('adds micro-paise values', () => {
    expect(addMicroPaise(100n, 200n, 300n)).toBe(600n);
    expect(addMicroPaise()).toBe(0n);
  });

  it('multiplies micro-paise by basis-point rates using integer arithmetic', () => {
    expect(multiplyByRateBps(10000n, 1800)).toBe(1800n);
    expect(multiplyByRateBps(10000n, 100)).toBe(100n);
    expect(multiplyByRateBps(10000n, 0.1)).toBe(1n);
  });

  it('clamps micro-paise to paise limits', () => {
    expect(clampMicroPaise(50n, 100, 200)).toBe(100n);
    expect(clampMicroPaise(500n, 100, 200)).toBe(200n);
    expect(clampMicroPaise(150n, 100, 200)).toBe(150n);
  });

  it('rejects invalid money and rate inputs', () => {
    expect(() => toMicroPaise(Number.NaN)).toThrow();
    expect(() => toMicroPaise(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => paiseToMicroPaise(-1)).toThrow();
    expect(() => paiseToMicroPaise(1.5)).toThrow();
    expect(() => multiplyByRateBps(100n, -1)).toThrow();
  });
});
