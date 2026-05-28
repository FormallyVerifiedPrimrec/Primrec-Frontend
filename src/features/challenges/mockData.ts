import type { Challenge, User } from './types';

export const MOCK_CHALLENGES: Challenge[] = [
  {
    id: '1',
    title: 'Addition',
    description: 'Implement a function `plus(x, y)` that returns the sum of $x$ and $y$.',
    templateFunc: 'plus(x, y) = rec(id_1_1, succ(id_3_3))(x, y)',
    postcondition: 'plus(x, y) = x + y',
    votes: 42,
    createdAt: Date.now() - 1000000,
    testCases: [
      { args: [2, 3], expected: 5 },
      { args: [0, 5], expected: 5 },
      { args: [10, 20], expected: 30 },
    ],
  },
  {
    id: '2',
    title: 'Multiplication',
    description: 'Implement a function `mult(x, y)` that returns the product of $x$ and $y$. Hint: Use your `plus` function or define it locally.',
    templateFunc: 'plus(x, y) = rec(id_1_1, succ(id_3_3))(x, y)\nmult(x, y) = rec(zero, plus(id_3_1, id_3_3))(x, y)',
    postcondition: 'mult(x, y) = x * y',
    votes: 28,
    createdAt: Date.now() - 500000,
    testCases: [
      { args: [2, 3], expected: 6 },
      { args: [0, 5], expected: 0 },
      { args: [4, 5], expected: 20 },
    ],
  },
  {
    id: '3',
    title: 'Factorial',
    description: 'Implement the factorial function $n!$. Remember that $0! = 1$.',
    templateFunc: 'plus(x, y) = rec(id_1_1, succ(id_3_3))(x, y)\nmult(x, y) = rec(zero, plus(id_3_1, id_3_3))(x, y)\nfact(n) = rec(succ(zero), mult(id_2_1, succ(id_2_2)))(n)',
    postcondition: 'fact(n) = n!',
    votes: 15,
    createdAt: Date.now() - 200000,
    testCases: [
      { args: [0], expected: 1 },
      { args: [1], expected: 1 },
      { args: [3], expected: 6 },
      { args: [5], expected: 120 },
    ],
  },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice', score: 1250 },
  { id: 'u2', name: 'Bob', score: 980 },
  { id: 'u3', name: 'Charlie', score: 750 },
  { id: 'u4', name: 'Dave', score: 400 },
];
