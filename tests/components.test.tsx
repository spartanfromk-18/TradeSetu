// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { BrokerLeaderboard } from '../src/components/BrokerLeaderboard';
import type { ComputeResult } from '../src/types/trade';

const mocks = vi.hoisted(() => ({
  compareBrokersInWorker: vi.fn(),
  putCachedQuote: vi.fn(() => Promise.resolve()),
  createQuoteFingerprint: vi.fn(() => Promise.resolve('a'.repeat(64))),
}));

vi.mock('../src/lib/workerClient', () => ({ compareBrokersInWorker: mocks.compareBrokersInWorker }));
vi.mock('../src/lib/quoteCache', () => ({ putCachedQuote: mocks.putCachedQuote }));
vi.mock('../src/lib/fingerprint', () => ({
  createQuoteFingerprint: mocks.createQuoteFingerprint,
}));

const results: readonly ComputeResult[] = [
  {
    brokerId: 'zerodha', brokerName: 'Zerodha', turnoverPaise: 201000, brokeragePaise: 2000,
    sttPaise: 2010, exchangeTransactionPaise: 65, sebiPaise: 21, stampDutyPaise: 30,
    gstPaise: 377, dpPaise: 1500, totalChargesPaise: 6003, breakevenPaise: 1201,
    netPnlPaise: -5003, breakdown: [],
  },
  {
    brokerId: 'groww', brokerName: 'Groww', turnoverPaise: 201000, brokeragePaise: 0,
    sttPaise: 2010, exchangeTransactionPaise: 65, sebiPaise: 21, stampDutyPaise: 30,
    gstPaise: 100, dpPaise: 1500, totalChargesPaise: 3726, breakevenPaise: 746,
    netPnlPaise: -2726, breakdown: [],
  },
];

beforeEach(() => {
  window.localStorage.clear();
  mocks.compareBrokersInWorker.mockReset();
  mocks.compareBrokersInWorker.mockResolvedValue(results);
});

afterEach(() => {
  cleanup();
});

describe('adaptive TradeSetu components', () => {
  it('renders junior, senior, and standard modes from the age control', async () => {
    render(<App />);
    await waitFor(() => expect(mocks.compareBrokersInWorker).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('slider'), { target: { value: '15' } });
    expect(screen.getByText('A simple explanation')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '65' } });
    expect(screen.getByText('Your result')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '30' } });
    expect(screen.queryByText('A simple explanation')).toBeNull();
    expect(screen.queryByText('Your result')).toBeNull();
  });

  it('renders broker rows, marks the cheapest broker, and updates selection', () => {
    const onSelect = vi.fn();
    render(<BrokerLeaderboard results={results} selectedBrokerId="zerodha" onSelect={onSelect} />);
    expect(screen.getByRole('row', { name: /Groww/ })).toBeTruthy();
    expect(screen.getByText('Lowest')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Selected' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onSelect).toHaveBeenCalledWith('groww');
  });

  it('shows invalid input errors and triggers worker comparison for valid input', async () => {
    render(<App />);
    await waitFor(() => expect(mocks.compareBrokersInWorker).toHaveBeenCalled());
    const buyPrice = screen.getByLabelText('Buy price (₹)');
    fireEvent.change(buyPrice, { target: { value: 'invalid' } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/valid numeric|numeric/i);
    fireEvent.change(buyPrice, { target: { value: '102' } });
    await waitFor(() => expect(mocks.compareBrokersInWorker.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByText('Broker leaderboard')).toBeTruthy();
  });
});
