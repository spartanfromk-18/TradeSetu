export type Segment =
  | 'equity_delivery'
  | 'equity_intraday'
  | 'futures'
  | 'options';

export type Exchange = 'NSE' | 'BSE';
export type Depository = 'CDSL' | 'NSDL';

export interface SttRate {
  readonly buyBps: number;
  readonly sellBps: number;
  readonly basis?: 'TURNOVER' | 'PREMIUM';
}

export interface DpCharge {
  readonly sellPerScripPaise: number;
  readonly gstApplicable: boolean;
}

export interface RateRegistry {
  readonly schemaVersion: string;
  readonly registryVersion: string;
  readonly currency: 'INR';
  readonly statutory: {
    readonly gstRateBps: number;
    readonly stt: Record<Segment, SttRate>;
    readonly transactionCharges: Record<Exchange, Record<Segment, number>>;
    readonly sebiTurnoverFeeBps: number;
    readonly stampDuty: Record<Segment, SttRate>;
    readonly dpCharges: Record<Depository, DpCharge>;
  };
  readonly brokers: readonly unknown[];
}
