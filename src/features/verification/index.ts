// Public surface of the verification feature. Import from here rather than the
// individual files so the internal layout can change freely.

export type {
  VerificationStatus,
  VerificationResult,
  VerificationEvent,
  SolverOutcome,
  SolveFn,
} from './types';
export { analyzeProgram, functionsWithoutPostcondition } from './analysis';
export type { ProgramAnalysis, VerifiableFunction } from './analysis';
export {
  buildFunctionSmt,
  buildFunctionSmtFromSource,
  prepareSmtContext,
} from './smtBuilder';
export { runVerification, computeDistances, VerificationAbortError } from './pipeline';
export {
  verificationRunner,
  verifyProgramOnce,
  VerificationRunner,
  VerificationCancelledError,
} from './runner';
export type { VerificationHandle } from './runner';
export { useVerification } from './useVerification';
export type { UseVerification } from './useVerification';
export { buildChallengeVerificationSource } from './challengeSource';
