import { formatInr } from '../lib/money';
import type { ComputeResult } from '../types/trade';

interface JuniorExplainerBarProps {
  readonly result: ComputeResult | null;
  readonly onSpeak: (text: string) => void;
}

function signedInr(valuePaise: number): string {
  return valuePaise < 0 ? `-${formatInr(Math.abs(valuePaise))}` : formatInr(valuePaise);
}

export function JuniorExplainerBar({ result, onSpeak }: JuniorExplainerBarProps): JSX.Element {
  const message: string = result === null
    ? 'Enter your trade details to see the total cost.'
    : `Your total charges are ${formatInr(result.totalChargesPaise)}. Your estimated profit or loss is ${signedInr(result.netPnlPaise)}.`;

  return (
    <section className="explainer-bar" aria-live="polite" aria-label="Junior explanation">
      <div>
        <p className="eyebrow">A simple explanation</p>
        <p>{message}</p>
      </div>
      <button
        className="button button--quiet"
        type="button"
        onClick={() => onSpeak(message)}
        disabled={result === null}
      >
        Listen
      </button>
    </section>
  );
}
