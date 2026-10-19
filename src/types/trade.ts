export type Segment =
  | 'equity_delivery'
  | 'equity_intraday'
  | 'futures'
  | 'options';

export type Exchange = 'NSE' | 'BSE';

export type Depository = 'CDSL' | 'NSDL';

export type ChargeModel = 'FLAT' | 'PERCENT';

export type RateBasis = 'TURNOVER' | 'PREMIUM';

export interface BrokerCharge {
  model: ChargeModel;
  buyPaise: number;
  sellPaise: number;
  minPaise: number;
  maxPaise: number;
  buyBps?: number;
  sellBps?: number;
}

export interface Broker {
  id: string;
  name: string;
  dp: Depository;
  accountOpeningFeePaise: number;
  amcAnnualPaise: number;
  equityDelivery: BrokerCharge;
  equityIntraday: BrokerCharge;
  futures: BrokerCharge;
  options: BrokerCharge;
}

export interface SttRate {
  buyBps: number;
  sellBps: number;
  basis?: RateBasis;
}

export interface DpCharge {
  fixedPaise: number;
}

export interface StampDutyRate {
  buyBps: number;
  sellBps: number;
  basis?: RateBasis;
}

export type SegmentRates = Record<Segment, number>;

export interface StatutoryRates {
  gstBps: number;
  stt: Record<Segment, SttRate>;
  exchangeTransactionCharges: Record<Exchange, SegmentRates>;
  sebiTurnoverFeeBps: number;
  stampDuty: Record<Segment, StampDutyRate>;
  dpCharges: Record<Depository, DpCharge>;
}

export interface RateRegistry {
  schemaVersion: string;
  registryVersion: string;
  currency: 'INR';
  statutory: StatutoryRates;
  brokers: Broker[];
}

export interface TradeInput {
  brokerId: string;
  segment: Segment;
  exchange: Exchange;
  buyPricePaise: number;
  sellPricePaise: number;
  quantity: number;
  lotSize: number;
}

export interface ChargeBreakdown {
  label: string;
  amountPaise: number;
}

export interface ComputeResult {
  brokerId: string;
  brokerName: string;
  turnoverPaise: number;
  brokeragePaise: number;
  sttPaise: number;
  exchangeTransactionPaise: number;
  sebiPaise: number;
  stampDutyPaise: number;
  gstPaise: number;
  dpPaise: number;
  totalChargesPaise: number;
  breakevenPaise: number;
  netPnlPaise: number;
  breakdown: readonly ChargeBreakdown[];
}
