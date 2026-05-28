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
  title: string;
  description: string; // Markdown & LaTeX supported
  templateFunc: string;
  postcondition: string; // Validation logic
  testCases: TestCase[];
  votes: number;
  createdAt: number;
}

export interface SubmissionResult {
  success: boolean;
  message: string;
  passedCount: number;
  totalCount: number;
}

export type ViewType = 'dashboard' | 'editor';
