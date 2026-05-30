import type { Challenge, User } from './types';

export const MOCK_CHALLENGES: Challenge[] = [
  {
    id: '1',
    creatorId: 'u1',
    title: 'Addition',
    description: 'Implement a function `plus(x, y)` that returns the sum of $x$ and $y$.',
    templateFunc: `plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);`,
    postcondition: 'plus(x, y) = x + y',
    suggestedSolution: '',
    votes: 42,
    userVote: 0,
    isSolved: false,
    createdAt: Date.now() - 1000000,
    testCases: [
      { args: [2, 3], expected: 5 },
      { args: [0, 5], expected: 5 },
      { args: [10, 20], expected: 30 },
    ],
  },
];

export const MOCK_USERS: User[] = [];
