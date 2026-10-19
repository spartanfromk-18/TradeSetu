import { computeAllBrokers, computeQuote } from '../lib/compute';
import { normalizeTradeInput } from '../lib/normalize';
import type { ComputeResult, TradeInput } from '../types/trade';

export type WorkerRequest =
  | {
      readonly type: 'COMPUTE_SINGLE';
      readonly id: string;
      readonly payload: Record<string, unknown>;
    }
  | {
      readonly type: 'COMPARE_ALL';
      readonly id: string;
      readonly payload: Record<string, unknown>;
    };

export type WorkerResponse =
  | {
      readonly type: 'SUCCESS';
      readonly id: string;
      readonly result: ComputeResult | readonly ComputeResult[];
    }
  | {
      readonly type: 'ERROR';
      readonly id: string;
      readonly message: string;
    };

type WorkerScope = {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ) => void;
  postMessage: (message: WorkerResponse) => void;
};

const workerScope: WorkerScope = self as unknown as WorkerScope;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): WorkerRequest {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.payload)) {
    throw new TypeError('Worker request must include an id and object payload.');
  }
  if (value.type !== 'COMPUTE_SINGLE' && value.type !== 'COMPARE_ALL') {
    throw new TypeError('Unsupported worker request type.');
  }

  return {
    type: value.type,
    id: value.id,
    payload: value.payload,
  };
}

function postError(id: string, error: unknown): void {
  const message: string = error instanceof Error ? error.message : 'Worker computation failed.';
  workerScope.postMessage({ type: 'ERROR', id, message });
}

function handleMessage(event: MessageEvent<unknown>): void {
  let requestId: string = '';
  try {
    const request: WorkerRequest = parseRequest(event.data);
    requestId = request.id;
    const input: TradeInput = normalizeTradeInput(request.payload);
    const result: ComputeResult | readonly ComputeResult[] = request.type === 'COMPUTE_SINGLE'
      ? computeQuote(input)
      : computeAllBrokers(input);
    workerScope.postMessage({ type: 'SUCCESS', id: request.id, result });
  } catch (error: unknown) {
    postError(requestId, error);
  }
}

workerScope.addEventListener('message', handleMessage);
