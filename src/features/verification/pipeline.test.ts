import { describe, expect, it, vi } from 'vitest';
import { runVerification, computeDistances, VerificationAbortError } from './pipeline';
import { analyzeProgram } from './analysis';
import type { SolveFn, VerificationResult } from './types';

const PROGRAM = `
plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);

mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);

post plus(x, y) -> r { r == x + y; }
post mul(x, y) -> r { r == x * y; }
`;

describe('computeDistances', () => {
  it('orders dependencies deeper than their callers', () => {
    const analysis = analyzeProgram(PROGRAM);
    const distances = computeDistances('mul', analysis);
    expect(distances.get('mul')).toBe(0);
    expect(distances.get('plus')! > distances.get('mul')!).toBe(true);
    expect(distances.get('plusBase')! > distances.get('plus')!).toBe(true);
  });
});

describe('runVerification', () => {
  it('verifies leaves before the target and skips functions without postconditions', async () => {
    const verifiedOrder: string[] = [];
    const solve: SolveFn = vi.fn(async (smt: string) => {
      // Identify the verified function by its asserted postcondition.
      if (smt.includes('(* x y)')) verifiedOrder.push('mul');
      else if (smt.includes('(+ x y)')) verifiedOrder.push('plus');
      return { status: 'verified' as const };
    });

    const results = await runVerification(PROGRAM, 'mul', {
      solve,
      onProgress: () => {},
    });

    // plus is verified before mul.
    expect(verifiedOrder).toEqual(['plus', 'mul']);
    // Helper functions without postconditions are skipped, not solved.
    expect(results.plusBase.status).toBe('skipped');
    expect(results.mulBase.status).toBe('skipped');
    expect(results.plus.status).toBe('verified');
    expect(results.mul.status).toBe('verified');
    expect(solve).toHaveBeenCalledTimes(2);
  });

  it('marks dependents as dependency-failed when a dependency fails', async () => {
    const solve: SolveFn = async (smt) => {
      if (smt.includes('(+ x y)')) {
        return { status: 'failed', counterExample: 'x=1' };
      }
      return { status: 'verified' };
    };

    const results = await runVerification(PROGRAM, 'mul', {
      solve,
      onProgress: () => {},
    });

    expect(results.plus.status).toBe('failed');
    expect(results.mul.status).toBe('dependency-failed');
  });

  it('reports progress events for each function', async () => {
    const events: Array<[string, VerificationResult]> = [];
    await runVerification(PROGRAM, 'plus', {
      solve: async () => ({ status: 'verified' }),
      onProgress: (name, result) => events.push([name, result]),
    });
    // plus should pass through 'verifying' and then 'verified'.
    const plusStatuses = events.filter(([n]) => n === 'plus').map(([, r]) => r.status);
    expect(plusStatuses).toEqual(['verifying', 'verified']);
  });

  it('aborts when the signal fires', async () => {
    const controller = new AbortController();
    const solve: SolveFn = async () => {
      controller.abort();
      return { status: 'verified' };
    };

    await expect(
      runVerification(PROGRAM, 'mul', {
        solve,
        onProgress: () => {},
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(VerificationAbortError);
  });
});
