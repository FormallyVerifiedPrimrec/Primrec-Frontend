import { describe, expect, it } from 'vitest';
import { buildChallengeVerificationSource } from './challengeSource';
import { analyzeProgram } from './analysis';
import { parseCompleteProgram } from '../../primrecLanguage';

// `plus` is defined; `mul` is intentionally NOT defined, so it stands in for
// "a function the participant has not written yet".
const PLUS_SOURCE = `plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);`;

const MUL_SOURCE = `mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);`;

const CHALLENGE_PLUS = `post plus(x, y) -> r {
  r == x + y;
}`;

const CHALLENGE_MUL = `post mul(x, y) -> r {
  r == x * y;
}`;

function hasErrors(source: string): boolean {
  return parseCompleteProgram(source).diagnostics.some((d) => d.severity === 'error');
}

function postconditionFor(source: string, name: string): string | undefined {
  return analyzeProgram(source).functions.find((f) => f.name === name)?.postconditionText;
}

describe('buildChallengeVerificationSource', () => {
  it('returns the source unchanged when there are no challenge postconditions', () => {
    expect(buildChallengeVerificationSource(PLUS_SOURCE, undefined)).toBe(PLUS_SOURCE);
    expect(buildChallengeVerificationSource(PLUS_SOURCE, null)).toBe(PLUS_SOURCE);
    expect(buildChallengeVerificationSource(PLUS_SOURCE, '   \n  ')).toBe(PLUS_SOURCE);
  });

  it('appends a challenge postcondition whose function is defined', () => {
    const result = buildChallengeVerificationSource(PLUS_SOURCE, CHALLENGE_PLUS);

    expect(result).toContain(PLUS_SOURCE);
    expect(result).toContain('post plus(x, y) -> r');
    // Challenge postcondition comes after the participant's code.
    expect(result.indexOf('post plus')).toBeGreaterThan(result.indexOf('plus(x, y) ='));
    // The merged source is a verifiable program (the function exists).
    expect(postconditionFor(result, 'plus')).toContain('r == x + y');
    expect(hasErrors(result)).toBe(false);
  });

  it('holds back a challenge postcondition whose function is not defined yet', () => {
    const result = buildChallengeVerificationSource(PLUS_SOURCE, CHALLENGE_MUL);

    // Nothing is merged in, so the participant keeps verifying what they have.
    expect(result).toBe(PLUS_SOURCE);
  });

  it('does not block verification when a challenge targets an undefined function', () => {
    // Regression: naive concatenation produced an "unknown function" error here,
    // which set hasErrors and stopped the participant verifying their helpers.
    const naive = `${PLUS_SOURCE}\n\n${CHALLENGE_MUL}`;
    expect(hasErrors(naive)).toBe(true);

    const merged = buildChallengeVerificationSource(PLUS_SOURCE, CHALLENGE_MUL);
    expect(hasErrors(merged)).toBe(false);
    expect(analyzeProgram(merged).hasErrors).toBe(false);
  });

  it('merges only the postconditions of functions that exist', () => {
    const both = `${CHALLENGE_PLUS}\n\n${CHALLENGE_MUL}`;
    const result = buildChallengeVerificationSource(PLUS_SOURCE, both);

    expect(result).toContain('post plus(x, y) -> r');
    expect(result).not.toContain('post mul');
    expect(hasErrors(result)).toBe(false);
  });

  it('starts enforcing a postcondition once its function is defined', () => {
    const withMul = `${PLUS_SOURCE}\n\n${MUL_SOURCE}`;
    const result = buildChallengeVerificationSource(withMul, CHALLENGE_MUL);

    expect(result).toContain('post mul(x, y) -> r');
    expect(postconditionFor(result, 'mul')).toContain('r == x * y');
    expect(hasErrors(result)).toBe(false);
  });

  it('lets the challenge postcondition override a participant postcondition for the same function', () => {
    const userWeakened = `post plus(x, y) -> r {
  r >= 0;
}

${PLUS_SOURCE}`;

    const result = buildChallengeVerificationSource(userWeakened, CHALLENGE_PLUS);

    // analyzeProgram resolves postconditions last-wins; the challenge block is
    // appended last, so the strict challenge constraint is the one that counts.
    expect(postconditionFor(result, 'plus')).toContain('r == x + y');
  });
});
