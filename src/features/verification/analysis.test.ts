import { describe, expect, it } from 'vitest';
import { analyzeProgram, functionsWithoutPostcondition } from './analysis';

const PROGRAM = `
plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);

post plus(x, y) -> r {
  r == x + y;
}
`;

describe('analyzeProgram', () => {
  it('marks only functions that have a postcondition', () => {
    const analysis = analyzeProgram(PROGRAM);
    expect(analysis.hasErrors).toBe(false);

    const byName = new Map(analysis.functions.map((fn) => [fn.name, fn]));
    expect(byName.get('plus')?.hasPostcondition).toBe(true);
    expect(byName.get('plusBase')?.hasPostcondition).toBe(false);
    expect(byName.get('plusStep')?.hasPostcondition).toBe(false);
  });

  it('exposes dependencies for ordering', () => {
    const analysis = analyzeProgram(PROGRAM);
    const plus = analysis.functions.find((fn) => fn.name === 'plus');
    expect(plus?.dependencies).toEqual(
      expect.arrayContaining(['plusBase', 'plusStep']),
    );
  });

  it('lists functions without a postcondition', () => {
    const analysis = analyzeProgram(PROGRAM);
    expect(functionsWithoutPostcondition(analysis).sort()).toEqual([
      'plusBase',
      'plusStep',
    ]);
  });

  it('reports errors for invalid programs', () => {
    const analysis = analyzeProgram('plus(x) = ;');
    expect(analysis.hasErrors).toBe(true);
  });
});
