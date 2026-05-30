import { describe, expect, it } from 'vitest';
import type { Challenge } from '../challenges/types';
import { checkChallengeIntegrity } from './integrityCheck';

const challenge: Challenge = {
  id: 'addition',
  creatorId: 'creator',
  title: 'Addition',
  description: 'Implement plus.',
  templateFunc: '',
  postcondition: `post plus(x, y) -> r {
  r == x + y;
}`,
  suggestedSolution: '',
  testCases: [],
  votes: 0,
  userVote: 0,
  isSolved: false,
  createdAt: 0,
};

describe('checkChallengeIntegrity', () => {
  it('accepts a challenge solution whose postcondition is supplied by the challenge', () => {
    const source = `plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);`;

    expect(checkChallengeIntegrity(source, challenge)).toEqual({ isValid: true });
  });

  it('still rejects a solution that removed the target function', () => {
    const source = `id(x) = x;`;

    expect(checkChallengeIntegrity(source, challenge)).toEqual({
      isValid: false,
      missingFunction: true,
      error: "Required function 'plus' is missing.",
    });
  });
});
