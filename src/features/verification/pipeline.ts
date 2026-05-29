// Verification orchestration.
//
// Given a program and a target function, this walks the dependency tree from
// the leaves upward and verifies each function that has a postcondition. The
// solver call itself is injected (`SolveFn`) so the pipeline stays pure and
// testable; the worker passes the real HTTP-backed solver. Steps for functions
// without a postcondition are skipped, and a function whose dependency failed is
// reported as `dependency-failed` instead of being sent to the solver.

import { analyzeProgram, type ProgramAnalysis } from './analysis';
import { prepareSmtContext, buildFunctionSmt } from './smtBuilder';
import type {
  SolveFn,
  VerificationResult,
  VerificationStatus,
} from './types';

export class VerificationAbortError extends Error {
  constructor() {
    super('Verification aborted.');
    this.name = 'VerificationAbortError';
  }
}

// Statuses of a dependency that should block a dependent function.
const BLOCKING_STATUSES: ReadonlySet<VerificationStatus> = new Set([
  'failed',
  'dependency-failed',
  'error',
]);

export interface RunVerificationOptions {
  solve: SolveFn;
  onProgress: (name: string, result: VerificationResult) => void;
  signal?: AbortSignal;
}

/**
 * Verify `target` and everything below it. Returns the final result map keyed
 * by function name. Throws `VerificationAbortError` if the signal fires.
 */
export async function runVerification(
  source: string,
  target: string,
  { solve, onProgress, signal }: RunVerificationOptions,
): Promise<Record<string, VerificationResult>> {
  const analysis = analyzeProgram(source);
  if (analysis.hasErrors || !analysis.program) {
    throw new Error('Cannot verify a program that has errors.');
  }

  const context = prepareSmtContext(source);
  const distances = computeDistances(target, analysis);
  const results: Record<string, VerificationResult> = {};

  const setResult = (name: string, result: VerificationResult) => {
    results[name] = result;
    onProgress(name, result);
  };

  // Furthest dependencies first (leaves), then walk up to the target.
  const maxDistance = Math.max(0, ...distances.values());
  for (let distance = maxDistance; distance >= 0; distance -= 1) {
    const level = [...distances.entries()]
      .filter(([, d]) => d === distance)
      .map(([name]) => name);

    for (const name of level) {
      throwIfAborted(signal);

      const fn = analysis.functions.find((item) => item.name === name);
      if (!fn) {
        continue;
      }

      const blockingDependency = fn.dependencies.find((dep) =>
        BLOCKING_STATUSES.has(results[dep]?.status ?? 'unknown'),
      );
      if (blockingDependency) {
        setResult(name, {
          status: 'dependency-failed',
          message: `Dependency '${blockingDependency}' did not verify.`,
        });
        continue;
      }

      if (!fn.hasPostcondition) {
        setResult(name, {
          status: 'skipped',
          message: 'No postcondition provided.',
        });
        continue;
      }

      const smt = buildFunctionSmt(context, name);
      if (smt === null) {
        // Defensive: hasPostcondition was true, so this should not happen.
        setResult(name, { status: 'skipped', message: 'No postcondition provided.' });
        continue;
      }

      setResult(name, { status: 'verifying' });
      const outcome = await solve(smt, signal);
      throwIfAborted(signal);
      setResult(name, {
        status: outcome.status,
        message: outcome.message,
        counterExample: outcome.counterExample,
        raw: outcome.raw,
        durationMs: outcome.durationMs,
      });
    }
  }

  return results;
}

/**
 * Distance of each reachable function from `root`, measured as the longest path
 * along the dependency edges. A larger distance means "deeper" in the tree, so
 * iterating from the largest distance down verifies leaves before their callers.
 */
export function computeDistances(
  root: string,
  analysis: ProgramAnalysis,
): Map<string, number> {
  const byName = new Map(analysis.functions.map((fn) => [fn.name, fn]));
  const distances = new Map<string, number>();

  const traverse = (name: string, current: number) => {
    const previous = distances.get(name) ?? -1;
    if (current <= previous) {
      return; // already reached via an equal or longer path
    }
    distances.set(name, current);

    const fn = byName.get(name);
    if (!fn) {
      return;
    }
    for (const dependency of fn.dependencies) {
      if (byName.has(dependency)) {
        traverse(dependency, current + 1);
      }
    }
  };

  if (byName.has(root)) {
    traverse(root, 0);
  }
  return distances;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new VerificationAbortError();
  }
}
