// Shared types for the verification feature.
//
// Verification works on a whole PrimRec program: every function that carries a
// postcondition becomes a task, the tasks are ordered leaves-first along the
// dependency tree, and each task is translated to an SMT-LIB Horn problem that
// is checked by the solver backend (Eldarica). This file only describes the
// data that flows between the orchestration pieces (pipeline, worker, runner,
// React hook); the actual work lives in the sibling modules.

export type VerificationStatus =
  // Not started yet (queued in the current run).
  | 'pending'
  // SMT problem sent to the solver, awaiting an answer.
  | 'verifying'
  // Postcondition holds (solver answered `sat` for the Horn encoding).
  | 'verified'
  // Postcondition can be violated, a counter-example exists (solver: `unsat`).
  | 'failed'
  // Solver could not decide (e.g. it returned `unknown` or timed out).
  | 'unknown'
  // A function this one depends on did not verify, so we skip it.
  | 'dependency-failed'
  // The function has no postcondition, nothing to check.
  | 'skipped'
  // Something went wrong outside the solver (parse/network/internal error).
  | 'error'
  // The run was aborted by the user or because the editor content changed.
  | 'cancelled';

export interface VerificationResult {
  status: VerificationStatus;
  message?: string;
  counterExample?: string;
  /** Raw solver stdout, kept for debugging / display. */
  raw?: string;
  /** Wall-clock time spent talking to the solver, in milliseconds. */
  durationMs?: number;
}

/** Events emitted while a verification run progresses. */
export type VerificationEvent =
  | { type: 'progress'; name: string; result: VerificationResult }
  | {
      type: 'done';
      target: string;
      results: Record<string, VerificationResult>;
    }
  | { type: 'error'; message: string };

/** Result of a single solver invocation, before it is mapped to a status. */
export interface SolverOutcome {
  status: 'verified' | 'failed' | 'unknown' | 'error';
  message?: string;
  counterExample?: string;
  raw?: string;
  durationMs?: number;
}

/**
 * Injectable solver call. The real implementation talks to the backend; tests
 * pass a stub. `signal` lets the pipeline abort an in-flight request.
 */
export type SolveFn = (smt: string, signal?: AbortSignal) => Promise<SolverOutcome>;

/** Messages the main thread sends to the verification worker. */
export type WorkerRequest = {
  type: 'start';
  source: string;
  target: string;
  solverBaseUrl: string;
};

/** Messages the worker sends back to the main thread. */
export type WorkerResponse = VerificationEvent;
