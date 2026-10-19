import registryJson from '../data/brokers_registry_v2026.json';
import {
  addMicroPaise,
  microPaiseToPaise,
  multiplyByRateBps,
  paiseToMicroPaise,
} from './money';
import type {
  Broker,
  BrokerCharge,
  ChargeBreakdown,
  ComputeResult,
  RateRegistry,
  Segment,
  TradeInput,
} from '../types/trade';

const BROKERAGE_LABEL: string = 'Brokerage';
const STT_LABEL: string = 'STT';
const EXCHANGE_LABEL: string = 'Exchange transaction charges';
const SEBI_LABEL: string = 'SEBI turnover fee';
const STAMP_LABEL: string = 'Stamp duty';
const GST_LABEL: string = 'GST';
const DP_LABEL: string = 'DP charges';
const MAX_SAFE_INTEGER_BIGINT: bigint = BigInt(Number.MAX_SAFE_INTEGER);

function loadRegistry(): RateRegistry {
  const candidate: unknown = registryJson;
  if (typeof candidate !== 'object' || candidate === null) {
    throw new TypeError('Broker registry must be an object.');
  }

  const registry: RateRegistry = candidate as RateRegistry;
  if (
    registry.currency !== 'INR' ||
    typeof registry.registryVersion !== 'string' ||
    !Array.isArray(registry.brokers) ||
    registry.brokers.length === 0
  ) {
    throw new TypeError('Broker registry has an invalid structure.');
  }
  return registry;
}

export const brokerRegistry: RateRegistry = loadRegistry();

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function paiseFromBigInt(value: bigint, name: string): number {
  if (value < 0n || value > MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError(`${name} exceeds the safe paise range.`);
  }
  return Number(value);
}

function turnover(pricePaise: number, quantity: number): number {
  assertNonNegativeSafeInteger(pricePaise, 'Price');
  assertNonNegativeSafeInteger(quantity, 'Quantity');
  return paiseFromBigInt(BigInt(pricePaise) * BigInt(quantity), 'Turnover');
}

function percentageChargePaise(amountPaise: number, rateBps: number): number {
  const amountMicroPaise: bigint = paiseToMicroPaise(amountPaise);
  return microPaiseToPaise(multiplyByRateBps(amountMicroPaise, rateBps));
}

function clampPaise(valuePaise: number, minimumPaise: number, maximumPaise: number): number {
  assertNonNegativeSafeInteger(minimumPaise, 'Minimum brokerage');
  assertNonNegativeSafeInteger(maximumPaise, 'Maximum brokerage');
  if (minimumPaise > maximumPaise) {
    throw new RangeError('Minimum brokerage cannot exceed maximum brokerage.');
  }
  return Math.min(Math.max(valuePaise, minimumPaise), maximumPaise);
}

function sideBrokerage(
  turnoverPaise: number,
  sidePaise: number,
  charge: BrokerCharge,
): number {
  const unboundedPaise: number = charge.model === 'FLAT'
    ? sidePaise
    : percentageChargePaise(turnoverPaise, sidePaise);
  return clampPaise(unboundedPaise, charge.minPaise, charge.maxPaise);
}

function segmentCharge(broker: Broker, segment: Segment): BrokerCharge {
  return broker[segment === 'equity_delivery'
    ? 'equityDelivery'
    : segment === 'equity_intraday'
      ? 'equityIntraday'
      : segment];
}

function chargeBreakdown(label: string, amountPaise: number): ChargeBreakdown {
  return { label, amountPaise };
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function validateTradeInput(input: TradeInput): void {
  if (typeof input.brokerId !== 'string' || input.brokerId.trim().length === 0) {
    throw new TypeError('Broker ID must be a non-empty string.');
  }
  assertNonNegativeSafeInteger(input.buyPricePaise, 'Buy price');
  assertNonNegativeSafeInteger(input.sellPricePaise, 'Sell price');
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new RangeError('Quantity must be greater than zero.');
  }
  if (!Number.isSafeInteger(input.lotSize) || input.lotSize <= 0) {
    throw new RangeError('Lot size must be greater than zero.');
  }
}

export function computeQuote(input: TradeInput): ComputeResult {
  validateTradeInput(input);
  const broker: Broker | undefined = brokerRegistry.brokers.find(
    (candidate: Broker) => candidate.id === input.brokerId,
  );
  if (broker === undefined) {
    throw new Error(`Unknown broker ID: ${input.brokerId}.`);
  }

  const buyTurnoverPaise: number = turnover(input.buyPricePaise, input.quantity);
  const sellTurnoverPaise: number = turnover(input.sellPricePaise, input.quantity);
  const turnoverPaise: number = paiseFromBigInt(
    BigInt(buyTurnoverPaise) + BigInt(sellTurnoverPaise),
    'Total turnover',
  );
  const charge: BrokerCharge = segmentCharge(broker, input.segment);
  const brokeragePaise: number = sideBrokerage(buyTurnoverPaise, charge.buyPaise, charge)
    + sideBrokerage(sellTurnoverPaise, charge.sellPaise, charge);

  const sttRate = brokerRegistry.statutory.stt[input.segment];
  const sttPaise: number = percentageChargePaise(buyTurnoverPaise, sttRate.buyBps)
    + percentageChargePaise(sellTurnoverPaise, sttRate.sellBps);
  const exchangeRate: number = brokerRegistry.statutory.exchangeTransactionCharges[
    input.exchange
  ][input.segment];
  const exchangeTransactionPaise: number = percentageChargePaise(turnoverPaise, exchangeRate);
  const sebiPaise: number = percentageChargePaise(
    turnoverPaise,
    brokerRegistry.statutory.sebiTurnoverFeeBps,
  );
  const stampRate = brokerRegistry.statutory.stampDuty[input.segment];
  const stampDutyPaise: number = percentageChargePaise(buyTurnoverPaise, stampRate.buyBps)
    + percentageChargePaise(sellTurnoverPaise, stampRate.sellBps);
  const gstBaseMicroPaise: bigint = addMicroPaise(
    paiseToMicroPaise(brokeragePaise),
    paiseToMicroPaise(exchangeTransactionPaise),
    paiseToMicroPaise(sebiPaise),
  );
  const gstPaise: number = microPaiseToPaise(
    multiplyByRateBps(gstBaseMicroPaise, brokerRegistry.statutory.gstBps),
  );
  const dpPaise: number = input.segment === 'equity_delivery' && sellTurnoverPaise > 0
    ? brokerRegistry.statutory.dpCharges[broker.dp].fixedPaise
    : 0;
  const totalChargesPaise: number = brokeragePaise
    + sttPaise
    + exchangeTransactionPaise
    + sebiPaise
    + stampDutyPaise
    + gstPaise
    + dpPaise;
  const grossPnlPaise: number = sellTurnoverPaise - buyTurnoverPaise;
  const breakevenPaise: number = paiseFromBigInt(
    ceilDivide(BigInt(totalChargesPaise) * 2n, BigInt(input.quantity)),
    'Break-even movement',
  );

  return {
    brokerId: broker.id,
    brokerName: broker.name,
    turnoverPaise,
    brokeragePaise,
    sttPaise,
    exchangeTransactionPaise,
    sebiPaise,
    stampDutyPaise,
    gstPaise,
    dpPaise,
    totalChargesPaise,
    breakevenPaise,
    netPnlPaise: grossPnlPaise - totalChargesPaise,
    breakdown: [
      chargeBreakdown(BROKERAGE_LABEL, brokeragePaise),
      chargeBreakdown(STT_LABEL, sttPaise),
      chargeBreakdown(EXCHANGE_LABEL, exchangeTransactionPaise),
      chargeBreakdown(SEBI_LABEL, sebiPaise),
      chargeBreakdown(STAMP_LABEL, stampDutyPaise),
      chargeBreakdown(GST_LABEL, gstPaise),
      chargeBreakdown(DP_LABEL, dpPaise),
    ],
  };
}

export function computeAllBrokers(input: TradeInput): readonly ComputeResult[] {
  return brokerRegistry.brokers
    .map((broker: Broker) => computeQuote({ ...input, brokerId: broker.id }))
    .sort((left: ComputeResult, right: ComputeResult) => {
      if (left.totalChargesPaise !== right.totalChargesPaise) {
        return left.totalChargesPaise - right.totalChargesPaise;
      }
      return left.brokerId.localeCompare(right.brokerId);
    });
}
