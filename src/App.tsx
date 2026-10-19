import { useEffect, useRef, useState } from 'react';
import { AccessibilityControls } from './components/AccessibilityControls';
import { BrokerLeaderboard } from './components/BrokerLeaderboard';
import { JuniorExplainerBar } from './components/JuniorExplainerBar';
import { SeniorReadout } from './components/SeniorReadout';
import { useAgeProfile } from './hooks/useAgeProfile';
import { createQuoteFingerprint } from './lib/fingerprint';
import { formatInr } from './lib/money';
import { normalizeTradeInput } from './lib/normalize';
import { putCachedQuote } from './lib/quoteCache';
import { compareBrokersInWorker } from './lib/workerClient';
import type { ComputeResult, Segment, TradeInput } from './types/trade';

const segments: readonly { value: Segment; label: string }[] = [
  { value: 'equity_delivery', label: 'Equity delivery' },
  { value: 'equity_intraday', label: 'Equity intraday' },
  { value: 'futures', label: 'Futures' },
  { value: 'options', label: 'Options' },
];

function signedInr(valuePaise: number): string {
  return valuePaise < 0 ? `-${formatInr(Math.abs(valuePaise))}` : formatInr(valuePaise);
}

function App(): JSX.Element {
  const { profile, updateAge, setVoiceEnabled, setHighContrast, speak } = useAgeProfile();
  const [segment, setSegment] = useState<Segment>('equity_delivery');
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE');
  const [brokerId, setBrokerId] = useState<string>('zerodha');
  const [buyPrice, setBuyPrice] = useState<string>('100');
  const [sellPrice, setSellPrice] = useState<string>('101');
  const [quantity, setQuantity] = useState<string>('10');
  const [results, setResults] = useState<readonly ComputeResult[]>([]);
  const [error, setError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const calculationSequence = useRef<number>(0);
  const selectedResult: ComputeResult | null = results.find((result) => result.brokerId === brokerId)
    ?? results[0]
    ?? null;

  useEffect(() => {
    const sequence: number = calculationSequence.current + 1;
    calculationSequence.current = sequence;
    const rawInput: Record<string, unknown> = {
      segment,
      exchange,
      buyPrice,
      sellPrice,
      quantity,
      lotSize: 1,
      brokerId,
    };

    async function calculate(): Promise<void> {
      setIsCalculating(true);
      try {
        const normalized: TradeInput = normalizeTradeInput(rawInput);
        const nextResults: readonly ComputeResult[] = await compareBrokersInWorker(rawInput);
        if (calculationSequence.current !== sequence) {
          return;
        }
        setResults(nextResults);
        setError('');
        const selected: ComputeResult | undefined = nextResults.find((result) => result.brokerId === brokerId)
          ?? nextResults[0];
        if (selected !== undefined) {
          const fingerprint: string = await createQuoteFingerprint(
            normalized,
          );
          await putCachedQuote(fingerprint, 'v2026.10.19', selected);
        }
      } catch (cause: unknown) {
        if (calculationSequence.current === sequence) {
          setResults([]);
          setError(cause instanceof Error ? cause.message : 'We could not calculate this trade.');
        }
      } finally {
        if (calculationSequence.current === sequence) {
          setIsCalculating(false);
        }
      }
    }

    void calculate();
  }, [brokerId, buyPrice, exchange, quantity, segment, sellPrice]);

  function selectBroker(nextBrokerId: string): void {
    setBrokerId(nextBrokerId);
  }

  return (
    <main className={`app-shell app-shell--${profile.fontSize}`}>
      <header className="hero-band">
        <div className="page-width hero-band__inner">
          <div>
            <p className="eyebrow">TradeSetu · private by design</p>
            <h1>Know the real cost before you trade.</h1>
            <p className="hero-copy">A local-first calculator for brokerage and statutory charges across Indian markets.</p>
          </div>
          <span className="privacy-note">Calculations stay in your browser</span>
        </div>
      </header>

      <div className="page-width page-stack">
        <AccessibilityControls
          profile={profile}
          onAgeChange={updateAge}
          onVoiceChange={setVoiceEnabled}
          onContrastChange={setHighContrast}
        />

        <section className="calculator-panel" aria-labelledby="calculator-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your trade</p>
              <h2 id="calculator-heading">Estimate your costs</h2>
            </div>
            <span className="calculation-status" aria-live="polite">
              {isCalculating ? 'Calculating…' : results.length > 0 ? 'Updated' : 'Waiting for details'}
            </span>
          </div>
          <div className="form-grid">
            <label className="field-label">Segment
              <select value={segment} onChange={(event) => setSegment(event.target.value as Segment)}>
                {segments.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="field-label">Exchange
              <select value={exchange} onChange={(event) => setExchange(event.target.value as 'NSE' | 'BSE')}>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </label>
            <label className="field-label">Broker
              <select value={brokerId} onChange={(event) => setBrokerId(event.target.value)}>
                <option value="zerodha">Zerodha</option>
                <option value="groww">Groww</option>
                <option value="upstox">Upstox</option>
                <option value="angel-one">Angel One</option>
              </select>
            </label>
            <label className="field-label">Buy price (₹)
              <input inputMode="decimal" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} />
            </label>
            <label className="field-label">Sell price (₹)
              <input inputMode="decimal" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} />
            </label>
            <label className="field-label">Quantity
              <input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        {profile.band === 'JUNIOR' && <JuniorExplainerBar result={selectedResult} onSpeak={speak} />}
        {profile.band === 'SENIOR' && <SeniorReadout result={selectedResult} onSpeak={speak} />}

        {selectedResult !== null && (
          <section className="result-strip" aria-label="Selected broker result">
            <div><span className="eyebrow">Selected broker</span><strong>{selectedResult.brokerName}</strong></div>
            <div><span className="eyebrow">Total charges</span><strong>{formatInr(selectedResult.totalChargesPaise)}</strong></div>
            <div><span className="eyebrow">Net profit or loss</span><strong>{signedInr(selectedResult.netPnlPaise)}</strong></div>
          </section>
        )}

        {results.length > 0 && (
          <BrokerLeaderboard results={results} selectedBrokerId={brokerId} onSelect={selectBroker} />
        )}

        <footer className="trust-footer">
          <p>
            Quote data is stored only locally in your browser using IndexedDB. TradeSetu does not send
            your calculator inputs to a backend.
          </p>
          <p>
            Estimates are for information only, not financial advice. Verify final charges with your
            broker&apos;s official contract note.
          </p>
        </footer>
      </div>
    </main>
  );
}

export default App;
