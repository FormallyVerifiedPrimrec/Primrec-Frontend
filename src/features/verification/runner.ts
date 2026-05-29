// Main-thread controller for verification runs.
//
// Enforces the "only one verification in the pipeline" rule: starting a new run
// terminates any previous worker. Terminating a worker is also how we cancel —
// it stops SMT generation and any in-flight solver request immediately. The
// runner is a singleton so the rule holds across the whole app.

import { getRuntimeEnv } from '../../config/runtimeEnv';
import type {
  VerificationEvent,
  VerificationResult,
  WorkerRequest,
  WorkerResponse,
} from './types';

export class VerificationCancelledError extends Error {
  constructor() {
    super('Verification was cancelled.');
    this.name = 'VerificationCancelledError';
  }
}

export interface VerificationHandle {
  /** Resolves with the final result map, rejects if cancelled or on error. */
  promise: Promise<Record<string, VerificationResult>>;
  cancel(): void;
}

export class VerificationRunner {
  private worker: Worker | null = null;
  private rejectActive: ((error: Error) => void) | null = null;

  get isRunning(): boolean {
    return this.worker !== null;
  }

  start(
    source: string,
    target: string,
    onEvent: (event: VerificationEvent) => void,
  ): VerificationHandle {
    // Single pipeline: tear down any run already in progress.
    this.cancel();

    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker = worker;

    const promise = new Promise<Record<string, VerificationResult>>(
      (resolve, reject) => {
        this.rejectActive = reject;

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const message = event.data;
          onEvent(message);

          if (message.type === 'done') {
            this.teardown(worker);
            resolve(message.results);
          } else if (message.type === 'error') {
            this.teardown(worker);
            reject(new Error(message.message));
          }
        };

        worker.onerror = (event) => {
          this.teardown(worker);
          reject(new Error(event.message || 'Verification worker crashed.'));
        };
      },
    );

    const request: WorkerRequest = {
      type: 'start',
      source,
      target,
      solverBaseUrl: getRuntimeEnv('VITE_SOLVER_API_URL', '/solver'),
    };
    worker.postMessage(request);

    return {
      promise,
      cancel: () => this.cancel(),
    };
  }

  cancel(): void {
    if (!this.worker) {
      return;
    }
    const worker = this.worker;
    const reject = this.rejectActive;
    this.teardown(worker);
    reject?.(new VerificationCancelledError());
  }

  private teardown(worker: Worker): void {
    worker.terminate();
    if (this.worker === worker) {
      this.worker = null;
      this.rejectActive = null;
    }
  }
}

/** App-wide singleton so only one verification can run at a time. */
export const verificationRunner = new VerificationRunner();

/**
 * One-shot verification for callers that only need the final result of a single
 * target (e.g. challenge creation). Still goes through the shared runner, so it
 * respects the single-pipeline rule.
 */
export async function verifyProgramOnce(
  source: string,
  target: string,
): Promise<VerificationResult> {
  const handle = verificationRunner.start(source, target, () => {});
  const results = await handle.promise;
  return results[target] ?? { status: 'unknown' };
}
