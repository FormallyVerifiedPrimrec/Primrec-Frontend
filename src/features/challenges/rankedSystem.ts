import { parsePrimRecProgram } from '../../primrecLanguage';
import { evaluatePrimRecFunction } from '../../primrecLanguage/interpreter';
import type { Challenge, SubmissionResult, User } from './types';
import { MOCK_USERS } from './mockData';

export class RankedSystem {
  private users: User[] = [...MOCK_USERS];

  verifySubmission(userId: string, challenge: Challenge, userCode: string): SubmissionResult {
    const parseResult = parsePrimRecProgram(userCode);
    
    if (!parseResult.program) {
      return {
        success: false,
        message: 'Compilation failed. Please check your syntax.',
        passedCount: 0,
        totalCount: challenge.testCases.length,
      };
    }

    // Assume the last function in the program is the one to test
    const targetFunctionName = parseResult.ast.definitions[parseResult.ast.definitions.length - 1].name;
    let passed = 0;

    try {
      for (const testCase of challenge.testCases) {
        const result = evaluatePrimRecFunction(parseResult.program, targetFunctionName, testCase.args);
        if (result === testCase.expected) {
          passed++;
        }
      }
    } catch (e) {
      return {
        success: false,
        message: `Execution error: ${e instanceof Error ? e.message : String(e)}`,
        passedCount: passed,
        totalCount: challenge.testCases.length,
      };
    }

    const success = passed === challenge.testCases.length;
    if (success) {
      this.updateUserScore(userId, 100); // Fixed score for now
    }

    return {
      success,
      message: success ? 'All tests passed!' : `${passed}/${challenge.testCases.length} tests passed.`,
      passedCount: passed,
      totalCount: challenge.testCases.length,
    };
  }

  getUsersSorted(): User[] {
    return [...this.users].sort((a, b) => b.score - a.score);
  }

  private updateUserScore(userId: string, points: number) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.score += points;
    }
  }
}

export const rankedSystem = new RankedSystem();
