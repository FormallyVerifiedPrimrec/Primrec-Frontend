// React hook around the verification runner.
//
// Exposes the live result map plus start/cancel controls, and — importantly —
// cancels the active run whenever the editor source changes or the component
// unmounts. That covers "abort verification when the editor content reloads".

import { useCallback, useEffect, useState } from 'react';
import { verificationRunner, VerificationCancelledError } from './runner';
import type { VerificationResult } from './types';

export interface UseVerification {
  results: Record<string, VerificationResult>;
  isRunning: boolean;
  error: string | null;
  start: (target: string) => void;
  cancel: () => void;
}

interface VerificationState {
  scopeKey: string;
  results: Record<string, VerificationResult>;
  isRunning: boolean;
  error: string | null;
}

export function useVerification(source: string, resetKey = ''): UseVerification {
  const scopeKey = `${resetKey}\u0000${source}`;
  const [state, setState] = useState<VerificationState>({
    scopeKey,
    results: {},
    isRunning: false,
    error: null,
  });

  if (state.scopeKey !== scopeKey) {
    setState({
      scopeKey,
      results: {},
      isRunning: false,
      error: null,
    });
  }

  const start = useCallback((target: string) => {
    setState({
      scopeKey,
      results: {},
      isRunning: true,
      error: null,
    });

    const handle = verificationRunner.start(
      source,
      target,
      (event) => {
        if (event.type === 'progress') {
          setState((prev) => {
            if (prev.scopeKey !== scopeKey) return prev;
            return {
              ...prev,
              results: { ...prev.results, [event.name]: event.result },
            };
          });
        } else if (event.type === 'done') {
          setState((prev) => {
            if (prev.scopeKey !== scopeKey) return prev;
            return { ...prev, isRunning: false };
          });
        } else if (event.type === 'error') {
          setState((prev) => {
            if (prev.scopeKey !== scopeKey) return prev;
            return { ...prev, error: event.message, isRunning: false };
          });
        }
      },
    );

    handle.promise.catch((reason) => {
      if (reason instanceof VerificationCancelledError) {
        setState((prev) => {
          if (prev.scopeKey !== scopeKey) return prev;
          return { ...prev, isRunning: false };
        });
        return;
      }
      setState((prev) => {
        if (prev.scopeKey !== scopeKey) return prev;
        return {
          ...prev,
          error: reason instanceof Error ? reason.message : String(reason),
          isRunning: false,
        };
      });
    });
  }, [scopeKey, source]);

  const cancel = useCallback(() => {
    verificationRunner.cancel();
    setState((prev) => {
      if (prev.scopeKey !== scopeKey) return prev;
      return { ...prev, isRunning: false };
    });
  }, [scopeKey]);

  // Reset stale verification data and abort the run when the editor content or
  // selected verification target changes. Unmounting also aborts the run.
  useEffect(() => {
    return () => {
      verificationRunner.cancel();
    };
  }, [scopeKey]);

  const isCurrentScope = state.scopeKey === scopeKey;

  return {
    results: isCurrentScope ? state.results : {},
    isRunning: isCurrentScope ? state.isRunning : false,
    error: isCurrentScope ? state.error : null,
    start,
    cancel,
  };
}
