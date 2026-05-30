export interface User {
  id: string;
  username: string;
  rankPoints: number;
  avatarData?: string;
}

export interface Solution {
  username: string;
  avatarData?: string;
  source: string;
  isCreator: boolean;
  solvedAt: number;
}

export interface TestCase {
  args: number[];
  expected: number;
}

export interface Challenge {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  templateFunc: string;
  postcondition: string;
  suggestedSolution?: string;
  testCases: TestCase[];
  votes: number;
  userVote: -1 | 0 | 1;
  isSolved: boolean;
  mySolution?: string;
  createdAt: number;
}

export interface SubmissionResult {
  success: boolean;
  message: string;
  passedCount: number;
  totalCount: number;
}

export type CreateChallengePayload = Omit<Challenge, 'id' | 'votes' | 'userVote' | 'isSolved' | 'createdAt' | 'creatorId'>;
