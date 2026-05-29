import { parsePrimRecProgram } from '../../primrecLanguage'
import { evaluatePrimRecFunction } from '../../primrecLanguage/interpreter'
import { getLeaderboard, saveSubmission } from '../../api/challengesApi'
import type { Challenge, SubmissionResult, User } from './types'

export class RankedSystem {
  async verifySubmission(challenge: Challenge, userCode: string): Promise<SubmissionResult> {
    const parseResult = parsePrimRecProgram(userCode)

    if (!parseResult.program) {
      return {
        success: false,
        message: 'Compilation failed. Please check your syntax.',
        passedCount: 0,
        totalCount: challenge.testCases.length,
      }
    }

    // Assume the last function in the program is the one to test
    const targetFunctionName = parseResult.ast.definitions[parseResult.ast.definitions.length - 1].name
    let passed = 0

    try {
      for (const testCase of challenge.testCases) {
        const result = evaluatePrimRecFunction(parseResult.program, targetFunctionName, testCase.args)
        if (result === testCase.expected) passed++
      }
    } catch (e) {
      return {
        success: false,
        message: `Execution error: ${e instanceof Error ? e.message : String(e)}`,
        passedCount: passed,
        totalCount: challenge.testCases.length,
      }
    }

    const success = passed === challenge.testCases.length

    // Persist the outcome in the backend (best submission source only on success)
    try {
      await saveSubmission(challenge.id, { success, source: success ? userCode : undefined })
    } catch (e) {
      console.error('Failed to persist submission:', e)
    }

    return {
      success,
      message: success ? 'All tests passed!' : `${passed}/${challenge.testCases.length} tests passed.`,
      passedCount: passed,
      totalCount: challenge.testCases.length,
    }
  }

  async getUsersSorted(): Promise<User[]> {
    return getLeaderboard()
  }
}

export const rankedSystem = new RankedSystem()
