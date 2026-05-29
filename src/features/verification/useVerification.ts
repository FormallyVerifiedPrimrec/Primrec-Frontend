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

export function useVerification(source: string): UseVerification {
  const [results, setResults] = useState<Record<string, VerificationResult>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback((target: string) => {
    setResults({});
    setError(null);
    setIsRunning(true);

    const handle = verificationRunner.start(
      source,
      target,
      (event) => {
        if (event.type === 'progress') {
          setResults((prev) => ({ ...prev, [event.name]: event.result }));
        } else if (event.type === 'done') {
          setIsRunning(false);
        } else if (event.type === 'error') {
          setError(event.message);
          setIsRunning(false);
        }
      },
    );

    handle.promise.catch((reason) => {
      if (reason instanceof VerificationCancelledError) {
        setIsRunning(false);
        return;
      }
      setError(reason instanceof Error ? reason.message : String(reason));
      setIsRunning(false);
    });
  }, [source]);

  const cancel = useCallback(() => {
    verificationRunner.cancel();
    setIsRunning(false);
  }, []);

  // Abort the run when the editor content changes or the panel unmounts.
  useEffect(() => {
    return () => {
      verificationRunner.cancel();
    };
  }, [source]);

  return { results, isRunning, error, start, cancel };
}
