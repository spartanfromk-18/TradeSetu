import type { ComputeResult } from '../types/trade';
import type { WorkerResponse } from '../workers/compute.worker';

export type WorkerRequestType = 'COMPUTE_SINGLE' | 'COMPARE_ALL';

type PendingRequest = {
  readonly resolve: (value: ComputeResult | readonly ComputeResult[]) => void;
  readonly reject: (reason: Error) => void;
};

const pendingRequests: Map<string, PendingRequest> = new Map();
let workerInstance: Worker | undefined;
let requestSequence: number = 0;

function createRequestId(): string {
  requestSequence += 1;
  return `${Date.now()}-${requestSequence}`;
}

function rejectPendingRequests(error: Error): void {
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
}

function handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
  const response: WorkerResponse = event.data;
  const pending: PendingRequest | undefined = pendingRequests.get(response.id);
  if (pending === undefined) {
    return;
  }
  pendingRequests.delete(response.id);
  if (response.type === 'SUCCESS') {
    pending.resolve(response.result);
  } else {
    pending.reject(new Error(response.message));
  }
}

function getWorker(): Worker {
  if (workerInstance === undefined) {
    workerInstance = new Worker(
      new URL('../workers/compute.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerInstance.addEventListener('message', handleWorkerMessage);
    workerInstance.addEventListener('error', () => {
      rejectPendingRequests(new Error('Compute worker failed.'));
    });
  }
  return workerInstance;
}

export function computeInWorker(
  type: WorkerRequestType,
  payload: Record<string, unknown>,
): Promise<ComputeResult | readonly ComputeResult[]> {
  const id: string = createRequestId();
  const worker: Worker = getWorker();
  return new Promise<ComputeResult | readonly ComputeResult[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    try {
      worker.postMessage({ type, id, payload });
    } catch (error: unknown) {
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error('Unable to send worker request.'));
    }
  });
}

export async function compareBrokersInWorker(
  payload: Record<string, unknown>,
): Promise<readonly ComputeResult[]> {
  const result: ComputeResult | readonly ComputeResult[] = await computeInWorker(
    'COMPARE_ALL',
    payload,
  );
  if (!Array.isArray(result)) {
    throw new TypeError('Worker comparison response must be an array.');
  }
  return result;
}
