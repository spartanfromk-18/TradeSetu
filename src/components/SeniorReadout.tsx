import { formatInr } from '../lib/money';
import type { ComputeResult } from '../types/trade';

interface SeniorReadoutProps {
  readonly result: ComputeResult | null;
  readonly onSpeak: (text: string) => void;
}

function signedInr(valuePaise: number): string {
  return valuePaise < 0 ? `-${formatInr(Math.abs(valuePaise))}` : formatInr(valuePaise);
}

export function SeniorReadout({ result, onSpeak }: SeniorReadoutProps): JSX.Element {
  const message: string = result === null
    ? 'No calculation available yet.'
    : `Total charges ${formatInr(result.totalChargesPaise)}. Net profit or loss ${signedInr(result.netPnlPaise)}. Break-even movement ${formatInr(result.breakevenPaise)}.`;

  return (
    <section className="senior-readout" aria-live="assertive" aria-label="Senior result readout">
      <p className="eyebrow">Your result</p>
      <p className="senior-readout__empty">{result === null ? message : 'Total charges'}</p>
      {result !== null && (
        <>
          <p className="senior-readout__total">{formatInr(result.totalChargesPaise)}</p>
          <dl className="senior-readout__details">
            <div><dt>Net profit or loss</dt><dd>{signedInr(result.netPnlPaise)}</dd></div>
            <div><dt>Break-even movement</dt><dd>{formatInr(result.breakevenPaise)}</dd></div>
          </dl>
        </>
      )}
      <button
        className="button button--primary button--wide"
        type="button"
        onClick={() => onSpeak(message)}
        disabled={result === null}
      >
        Read result aloud
      </button>
    </section>
  );
}
