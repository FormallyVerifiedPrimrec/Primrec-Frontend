// Web worker entry point for verification.
//
// Running the pipeline in a worker keeps the UI responsive while SMT problems
// are generated and sent to the solver, and lets the main thread cancel a run
// instantly by terminating the worker. The worker owns one run at a time; the
// runner on the main thread guarantees only one worker exists.

/// <reference lib="webworker" />

import { runVerification, VerificationAbortError } from './pipeline';
import { solveSmt } from './solverClient';
import type { SolveFn, WorkerRequest, WorkerResponse } from './types';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let abortController: AbortController | null = null;

ctx.onmessage = async (event: MessageEvent<WorkerRequest | { type: 'cancel' }>) => {
  const message = event.data;

  if (message.type === 'cancel') {
    abortController?.abort();
    return;
  }

  if (message.type !== 'start') {
    return;
  }

  abortController = new AbortController();
  const solve: SolveFn = (smt, signal) =>
    solveSmt(smt, { baseUrl: message.solverBaseUrl, signal });

  try {
    const results = await runVerification(message.source, message.target, {
      solve,
      onProgress: (name, result) => post({ type: 'progress', name, result }),
      signal: abortController.signal,
    });
    post({ type: 'done', target: message.target, results });
  } catch (error) {
    if (error instanceof VerificationAbortError) {
      return; // cancelled — the runner already tore the worker down
    }
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

function post(message: WorkerResponse) {
  ctx.postMessage(message);
}
