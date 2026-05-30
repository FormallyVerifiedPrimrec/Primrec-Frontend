// Challenge integrity check.
//
// Verifies that the editor content still contains the function a challenge asks
// for. Challenge postconditions are owned by the challenge and are merged into
// the verification source separately, so participants do not need to duplicate
// them in the editable source just to submit.

import type { Challenge } from '../challenges/types';
import { analyzeProgram } from '../verification';

export interface IntegrityStatus {
  isValid: boolean;
  missingFunction?: boolean;
  error?: string;
}

export function checkChallengeIntegrity(source: string, challenge: Challenge): IntegrityStatus {
  const analysis = analyzeProgram(source);

  // The challenge's expected entry function is encoded as the leading
  // identifier of its stored postcondition (e.g. "plus(x, y) -> r { ... }" or
  // "post plus(x, y) -> r { ... }").
  const match = challenge.postcondition.match(/^\s*(?:post\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/);
  const targetName = match ? match[1] : null;

  if (!targetName) return { isValid: true }; // Cannot determine target

  const fn = analysis.functions.find((item) => item.name === targetName);

  if (!fn) {
    return {
      isValid: false,
      missingFunction: true,
      error: `Required function '${targetName}' is missing.`,
    };
  }

  return { isValid: true };
}
