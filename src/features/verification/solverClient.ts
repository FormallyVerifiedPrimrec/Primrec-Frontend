// HTTP client for the solver backend.
//
// The backend exposes `POST {base}/solve` taking an SMT-LIB problem as the
// request body and answering with JSON describing the solver result. For the
// Horn encoding used here the mapping is:
//   sat     -> postcondition holds            -> 'verified'
//   unsat   -> counter-example exists          -> 'failed'
//   unknown -> solver gave up                  -> 'unknown'
//   timeout -> solver was killed after 5s      -> 'unknown' (with a note)
//   error   -> solver crashed / bad input      -> 'error'

import type { SolverOutcome } from './types';

interface SolverResponse {
  status?: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';
  output?: string;
  error?: string | null;
}

export interface SolveOptions {
  baseUrl: string;
  signal?: AbortSignal;
}

export async function solveSmt(
  smt: string,
  { baseUrl, signal }: SolveOptions,
): Promise<SolverOutcome> {
  const url = `${baseUrl.replace(/\/+$/, '')}/solve`;
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: smt,
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error; // propagate cancellation to the pipeline
    }
    return {
      status: 'error',
      message: `Could not reach the solver: ${describeError(error)}`,
      durationMs: Date.now() - started,
    };
  }

  const durationMs = Date.now() - started;

  if (!response.ok) {
    return {
      status: 'error',
      message: `Solver responded with HTTP ${response.status}.`,
      durationMs,
    };
  }

  const payload = await parseBody(response);
  return mapResponse(payload, durationMs);
}

function mapResponse(payload: SolverResponse, durationMs: number): SolverOutcome {
  const raw = payload.output ?? '';
  switch (payload.status) {
    case 'sat':
      return { status: 'verified', raw, durationMs };
    case 'unsat':
      return {
        status: 'failed',
        message: 'Postcondition does not hold; the solver found a counter-example.',
        counterExample: raw.trim() || undefined,
        raw,
        durationMs,
      };
    case 'timeout':
      return {
        status: 'unknown',
        message: 'Solver timed out (5s limit).',
        raw,
        durationMs,
      };
    case 'unknown':
      return {
        status: 'unknown',
        message: 'Solver could not determine validity.',
        raw,
        durationMs,
      };
    case 'error':
    default:
      return {
        status: 'error',
        message: payload.error ?? 'Solver returned an unexpected result.',
        raw,
        durationMs,
      };
  }
}

async function parseBody(response: Response): Promise<SolverResponse> {
  const text = await response.text();
  if (!text) {
    return { status: 'error', error: 'Empty solver response.' };
  }
  try {
    return JSON.parse(text) as SolverResponse;
  } catch {
    // Be lenient: a plain-text body is treated as raw solver output.
    return { status: classifyRawOutput(text), output: text };
  }
}

/** Fallback classification when the backend returns plain solver output. */
function classifyRawOutput(text: string): SolverResponse['status'] {
  const lowered = text.toLowerCase();
  if (lowered.includes('unsat')) return 'unsat';
  if (lowered.includes('sat')) return 'sat';
  if (lowered.includes('unknown')) return 'unknown';
  return 'error';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
