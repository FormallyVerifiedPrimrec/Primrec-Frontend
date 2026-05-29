export interface User {
  id: string;
  name: string;
  score: number;
}

export interface TestCase {
  args: number[];
  expected: number;
}

export interface Challenge {
  id: string;
  creatorId: string;
  title: string;
  description: string; // Markdown & LaTeX supported
  templateFunc: string;
  postcondition: string; // Validation logic
  suggestedSolution?: string; // Hidden from users, used for verification
  testCases: TestCase[];
  votes: number;
  userVote: -1 | 0 | 1;
  createdAt: number;
}

export interface SubmissionResult {
  success: boolean;
  message: string;
  passedCount: number;
  totalCount: number;
}

export type CreateChallengePayload = Omit<Challenge, 'id' | 'votes' | 'userVote' | 'createdAt' | 'creatorId'>;
