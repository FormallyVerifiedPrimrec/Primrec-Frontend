import { describe, expect, it } from 'vitest';
import { getFunctionSignatures } from '../primrecLanguage';
import {
  getPrimRecDependencyCompletionContext,
  getPrimRecDependencyCompletionSignatures,
} from './primRecCompletion';

function sourceWithCursor(source: string): { source: string; offset: number } {
  const offset = source.indexOf('|');
  if (offset === -1) {
    throw new Error('Test source must include a cursor marker.');
  }

  return {
    source: source.slice(0, offset) + source.slice(offset + 1),
    offset,
  };
}

describe('primrec completion context', () => {
  it('detects base and step slots with their expected arities', () => {
    const base = sourceWithCursor(`base(x) = x;
step(x, y, previous) = previous;
f(x, y) = primrec(|);`);
    const step = sourceWithCursor(`base(x) = x;
step(x, y, previous) = previous;
f(x, y) = primrec(base, |);`);

    expect(getPrimRecDependencyCompletionContext(base.source, base.offset)).toMatchObject({
      role: 'base',
      expectedArity: 1,
    });
    expect(getPrimRecDependencyCompletionContext(step.source, step.offset)).toMatchObject({
      role: 'step',
      expectedArity: 3,
    });
  });

  it('offers only visible functions with the arity required by the base slot', () => {
    const { source, offset } = sourceWithCursor(`baseZero() = zero();
baseOne(x) = x;
stepThree(x, y, previous) = previous;
f(x, y) = primrec(|);
laterBase(x) = x;`);
    const context = getPrimRecDependencyCompletionContext(source, offset);

    expect(context).toBeDefined();
    expect(
      getPrimRecDependencyCompletionSignatures(
        getFunctionSignatures(source),
        context!,
      ).map((signature) => signature.name),
    ).toEqual(['succ', 'baseOne']);
  });

  it('offers only visible functions with the arity required by the step slot', () => {
    const { source, offset } = sourceWithCursor(`baseOne(x) = x;
stepThree(x, y, previous) = previous;
wrongStep(x, y) = x;
f(x, y) = primrec(baseOne, |);
laterStep(x, y, previous) = previous;`);
    const context = getPrimRecDependencyCompletionContext(source, offset);

    expect(context).toBeDefined();
    expect(
      getPrimRecDependencyCompletionSignatures(
        getFunctionSignatures(source),
        context!,
      ).map((signature) => signature.name),
    ).toEqual(['stepThree']);
  });

  it('offers built-ins as names when they match the primrec dependency arity', () => {
    const { source, offset } = sourceWithCursor(`step(y, previous) = previous;
f(x) = primrec(|);`);
    const context = getPrimRecDependencyCompletionContext(source, offset);

    expect(context).toMatchObject({ role: 'base', expectedArity: 0 });
    expect(
      getPrimRecDependencyCompletionSignatures(
        getFunctionSignatures(source),
        context!,
      ).map((signature) => signature.name),
    ).toEqual(['zero']);
  });

  it('does not switch to dependency completion outside primrec arguments', () => {
    const { source, offset } = sourceWithCursor(`base(x) = x;
f(x) = base(|);`);

    expect(getPrimRecDependencyCompletionContext(source, offset)).toBeUndefined();
  });
});
