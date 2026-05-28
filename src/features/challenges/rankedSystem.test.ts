import { describe, it, expect } from 'vitest';
import { RankedSystem } from './rankedSystem';
import { MOCK_CHALLENGES } from './mockData';

describe('RankedSystem', () => {
  const rankedSystem = new RankedSystem();
  const additionChallenge = MOCK_CHALLENGES[0];

  it('should verify a correct solution', () => {
    const userCode = 'plus(x, y) = rec(id_1_1, succ(id_3_3))(x, y)';
    const result = rankedSystem.verifySubmission('testUser', additionChallenge, userCode);
    
    expect(result.success).toBe(true);
    expect(result.passedCount).toBe(additionChallenge.testCases.length);
    expect(result.message).toBe('All tests passed!');
  });

  it('should fail an incorrect solution', () => {
    const userCode = 'plus(x, y) = zero';
    const result = rankedSystem.verifySubmission('testUser', additionChallenge, userCode);
    
    expect(result.success).toBe(false);
    expect(result.passedCount).toBeLessThan(additionChallenge.testCases.length);
  });

  it('should return compilation error for invalid syntax', () => {
    const userCode = 'plus(x, y) = oops';
    const result = rankedSystem.verifySubmission('testUser', additionChallenge, userCode);
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('Compilation failed');
  });
});
