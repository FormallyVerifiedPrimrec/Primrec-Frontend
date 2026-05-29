import { parsePrimRecProgram } from '../../primrecLanguage';
import { evaluatePrimRecFunction } from '../../primrecLanguage/interpreter';
import { supabase } from '../../supabaseClient';
import type { Challenge, SubmissionResult, User } from './types';

export class RankedSystem {
  async verifySubmission(challenge: Challenge, userCode: string): Promise<SubmissionResult> {
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
    
    // Save interaction to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_interactions')
        .upsert({
          user_id: user.id,
          challenge_id: challenge.id,
          has_solved: success,
          best_submission_source: success ? userCode : undefined // Only save source on success for now
        }, { onConflict: 'user_id,challenge_id' });
    }

    return {
      success,
      message: success ? 'All tests passed!' : `${passed}/${challenge.testCases.length} tests passed.`,
      passedCount: passed,
      totalCount: challenge.testCases.length,
    };
  }

  async getUsersSorted(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, rank_points')
      .order('rank_points', { ascending: false });

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.username,
      score: row.rank_points
    }));
  }
}

export const rankedSystem = new RankedSystem();
