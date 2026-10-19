import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compareBrokersInWorker,
  computeInWorker,
} from '../src/lib/workerClient';
import type { WorkerRequest, WorkerResponse } from '../src/workers/compute.worker';
import type { ComputeResult } from '../src/types/trade';

type Listener = (event: Event) => void;

class MockWorker {
  static instances: MockWorker[] = [];
  readonly messages: WorkerRequest[] = [];
  private readonly listeners: Map<string, Listener[]> = new Map();

  public constructor() {
    MockWorker.instances.push(this);
  }

  public addEventListener(type: string, listener: Listener): void {
    const listeners: Listener[] = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  public postMessage(message: WorkerRequest): void {
    this.messages.push(message);
  }

  public clearMessages(): void {
    this.messages.length = 0;
  }

  public respond(response: WorkerResponse): void {
    const event: MessageEvent<WorkerResponse> = new MessageEvent('message', { data: response });
    for (const listener of this.listeners.get('message') ?? []) {
      listener(event);
    }
  }

  public fail(): void {
    const event: Event = new Event('error');
    for (const listener of this.listeners.get('error') ?? []) {
      listener(event);
    }
  }
}

const sampleResult: ComputeResult = {
  brokerId: 'zerodha',
  brokerName: 'Zerodha',
  turnoverPaise: 201000,
  brokeragePaise: 2000,
  sttPaise: 2010,
  exchangeTransactionPaise: 65,
  sebiPaise: 21,
  stampDutyPaise: 30,
  gstPaise: 377,
  dpPaise: 1500,
  totalChargesPaise: 6003,
  breakevenPaise: 1201,
  netPnlPaise: -5003,
  breakdown: [],
};

function currentWorker(): MockWorker {
  const worker: MockWorker | undefined = MockWorker.instances.at(-1);
  if (worker === undefined) {
    throw new Error('Mock worker was not created.');
  }
  return worker;
}

describe('worker client', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
    MockWorker.instances.at(-1)?.clearMessages();
  });

  it('resolves broker comparisons with an array', async () => {
    const promise: Promise<readonly ComputeResult[]> = compareBrokersInWorker({});
    const worker: MockWorker = currentWorker();
    worker.respond({ type: 'SUCCESS', id: worker.messages[0].id, result: [sampleResult] });
    await expect(promise).resolves.toEqual([sampleResult]);
  });

  it('rejects when the worker returns an error', async () => {
    const promise: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const worker: MockWorker = currentWorker();
    worker.respond({ type: 'ERROR', id: worker.messages[0].id, message: 'Invalid trade.' });
    await expect(promise).rejects.toThrow('Invalid trade.');
  });

  it('generates unique request IDs', async () => {
    const first: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const second: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const worker: MockWorker = currentWorker();
    expect(worker.messages[0].id).not.toBe(worker.messages[1].id);
    worker.respond({ type: 'SUCCESS', id: worker.messages[0].id, result: sampleResult });
    worker.respond({ type: 'SUCCESS', id: worker.messages[1].id, result: sampleResult });
    await Promise.all([first, second]);
  });

  it('resolves the matching comparison request', async () => {
    const promise: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPARE_ALL',
      {},
    );
    const worker: MockWorker = currentWorker();
    worker.respond({ type: 'SUCCESS', id: worker.messages[0].id, result: [sampleResult] });
    await expect(promise).resolves.toEqual([sampleResult]);
  });

  it('resolves the matching single computation request', async () => {
    const promise: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const worker: MockWorker = currentWorker();
    worker.respond({ type: 'SUCCESS', id: worker.messages[0].id, result: sampleResult });
    await expect(promise).resolves.toEqual(sampleResult);
  });

  it('rejects only the request matching an error response', async () => {
    const first: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const second: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const worker: MockWorker = currentWorker();
    worker.respond({ type: 'ERROR', id: worker.messages[0].id, message: 'First failed.' });
    worker.respond({ type: 'SUCCESS', id: worker.messages[1].id, result: sampleResult });
    await expect(first).rejects.toThrow('First failed.');
    await expect(second).resolves.toEqual(sampleResult);
  });

  it('rejects every pending request on worker failure', async () => {
    const first: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const second: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPARE_ALL',
      {},
    );
    currentWorker().fail();
    await expect(first).rejects.toThrow('Compute worker failed.');
    await expect(second).rejects.toThrow('Compute worker failed.');
  });

  it('removes pending requests after success and error responses', async () => {
    const success: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    const worker: MockWorker = currentWorker();
    worker.respond({ type: 'SUCCESS', id: worker.messages[0].id, result: sampleResult });
    await expect(success).resolves.toEqual(sampleResult);

    const failure: Promise<ComputeResult | readonly ComputeResult[]> = computeInWorker(
      'COMPUTE_SINGLE',
      {},
    );
    worker.respond({ type: 'ERROR', id: worker.messages[1].id, message: 'Failed.' });
    await expect(failure).rejects.toThrow('Failed.');
  });

  it('rejects a non-array comparison response', async () => {
    const promise: Promise<readonly ComputeResult[]> = compareBrokersInWorker({});
    const worker: MockWorker = currentWorker();
    worker.respond({ type: 'SUCCESS', id: worker.messages[0].id, result: sampleResult });
    await expect(promise).rejects.toThrow(TypeError);
  });
});
