import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verificationRunner } from './runner';
import type { VerificationEvent } from './types';
import { useVerification } from './useVerification';

vi.mock('./runner', () => {
  class VerificationCancelledError extends Error {
    constructor() {
      super('Verification was cancelled.');
      this.name = 'VerificationCancelledError';
    }
  }

  return {
    VerificationCancelledError,
    verificationRunner: {
      start: vi.fn(),
      cancel: vi.fn(),
    },
  };
});

describe('useVerification', () => {
  let emit: ((event: VerificationEvent) => void) | undefined;

  beforeEach(() => {
    emit = undefined;
    vi.mocked(verificationRunner.cancel).mockClear();
    vi.mocked(verificationRunner.start).mockReset();
    vi.mocked(verificationRunner.start).mockImplementation((_source, _target, onEvent) => {
      emit = onEvent;
      return {
        promise: new Promise(() => {}),
        cancel: vi.fn(),
      };
    });
  });

  it('clears previous results when the source changes', () => {
    const { result, rerender } = renderHook(
      ({ source, target }) => useVerification(source, target),
      { initialProps: { source: 'a() = zero();', target: 'a' } },
    );

    act(() => {
      result.current.start('a');
      emit?.({
        type: 'progress',
        name: 'a',
        result: { status: 'verified' },
      });
    });

    expect(result.current.results.a?.status).toBe('verified');

    rerender({ source: 'a() = succ(zero());', target: 'a' });

    expect(result.current.results).toEqual({});
    expect(result.current.error).toBeNull();
    expect(result.current.isRunning).toBe(false);

    rerender({ source: 'a() = zero();', target: 'a' });

    expect(result.current.results).toEqual({});
  });

  it('clears previous results when the selected target changes', () => {
    const { result, rerender } = renderHook(
      ({ source, target }) => useVerification(source, target),
      { initialProps: { source: 'a() = zero();\nb() = zero();', target: 'a' } },
    );

    act(() => {
      result.current.start('a');
      emit?.({
        type: 'progress',
        name: 'a',
        result: { status: 'verified' },
      });
    });

    expect(result.current.results.a?.status).toBe('verified');

    rerender({ source: 'a() = zero();\nb() = zero();', target: 'b' });

    expect(result.current.results).toEqual({});
    expect(result.current.error).toBeNull();
    expect(result.current.isRunning).toBe(false);

    rerender({ source: 'a() = zero();\nb() = zero();', target: 'a' });

    expect(result.current.results).toEqual({});
  });
});
