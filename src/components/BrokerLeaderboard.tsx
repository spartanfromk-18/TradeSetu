import { formatInr } from '../lib/money';
import type { ComputeResult } from '../types/trade';

interface BrokerLeaderboardProps {
  readonly results: readonly ComputeResult[];
  readonly selectedBrokerId: string;
  readonly onSelect: (brokerId: string) => void;
}

function signedDifference(valuePaise: number): string {
  return valuePaise === 0 ? 'Lowest' : `+${formatInr(valuePaise)}`;
}

export function BrokerLeaderboard({
  results,
  selectedBrokerId,
  onSelect,
}: BrokerLeaderboardProps): JSX.Element {
  const visibleResults: readonly ComputeResult[] = [...results]
    .sort((left, right) => left.totalChargesPaise - right.totalChargesPaise)
    .slice(0, 25);
  const cheapest: number = visibleResults[0]?.totalChargesPaise ?? 0;

  return (
    <section className="leaderboard" aria-labelledby="leaderboard-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Compare the market</p>
          <h2 id="leaderboard-heading">Broker leaderboard</h2>
        </div>
        <span className="result-count">{visibleResults.length} brokers</span>
      </div>
      <div className="table-scroll">
        <table>
          <caption>Broker charges ranked from lowest to highest total cost</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Broker</th>
              <th scope="col">Brokerage</th>
              <th scope="col">Statutory charges</th>
              <th scope="col">Total charges</th>
              <th scope="col">Difference</th>
              <th scope="col"><span className="sr-only">Selection</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleResults.map((result, index) => {
              const statutoryPaise: number = result.sttPaise
                + result.exchangeTransactionPaise
                + result.sebiPaise
                + result.stampDutyPaise
                + result.gstPaise
                + result.dpPaise;
              const selected: boolean = selectedBrokerId === result.brokerId;
              return (
                <tr key={result.brokerId} className={selected ? 'is-selected' : undefined}>
                  <td>{index + 1}</td>
                  <th scope="row">{result.brokerName}</th>
                  <td>{formatInr(result.brokeragePaise)}</td>
                  <td>{formatInr(statutoryPaise)}</td>
                  <td className="strong-cell">{formatInr(result.totalChargesPaise)}</td>
                  <td>{signedDifference(result.totalChargesPaise - cheapest)}</td>
                  <td>
                    <button
                      className="select-button"
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(result.brokerId)}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
