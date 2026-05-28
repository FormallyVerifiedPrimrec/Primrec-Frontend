import { describe, expect, it } from 'vitest';
import { parsePrimRecProgram } from '.';
import { evaluatePrimRecFunction } from './interpreter';
import type { NormalizedProgram } from './types';

function parseValidProgram(source: string): NormalizedProgram {
  const result = parsePrimRecProgram(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.program).toBeDefined();
  return result.program!;
}

describe('evaluatePrimRecFunction', () => {
  it('evaluates nullary zero functions', () => {
    const program = parseValidProgram('z() = zero();');

    expect(evaluatePrimRecFunction(program, 'z', [])).toBe(0);
  });

  it('evaluates numeric literals', () => {
    const program = parseValidProgram('five() = 5;');

    expect(evaluatePrimRecFunction(program, 'five', [])).toBe(5);
  });

  it('evaluates projections for first and later parameters', () => {
    const program = parseValidProgram(`first(x, y, z) = x;
last(x, y, z) = z;`);

    expect(evaluatePrimRecFunction(program, 'first', [7, 8, 9])).toBe(7);
    expect(evaluatePrimRecFunction(program, 'last', [7, 8, 9])).toBe(9);
  });

  it('evaluates nested successors', () => {
    const program = parseValidProgram('addThree(x) = succ(succ(succ(x)));');

    expect(evaluatePrimRecFunction(program, 'addThree', [4])).toBe(7);
  });

  it('evaluates composition with user-defined functions', () => {
    const program = parseValidProgram(`inc(x) = succ(x);
incTwice(x) = inc(inc(x));`);

    expect(evaluatePrimRecFunction(program, 'incTwice', [10])).toBe(12);
  });

  it('evaluates composition with repeated arguments', () => {
    const program = parseValidProgram(`second(a, b) = b;
copySecond(x) = second(x, x);`);

    expect(evaluatePrimRecFunction(program, 'copySecond', [13])).toBe(13);
  });

  it('evaluates addition by primitive recursion', () => {
    const program = parseValidProgram(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);`);

    expect(evaluatePrimRecFunction(program, 'plus', [0, 0])).toBe(0);
    expect(evaluatePrimRecFunction(program, 'plus', [4, 0])).toBe(4);
    expect(evaluatePrimRecFunction(program, 'plus', [4, 3])).toBe(7);
  });

  it('passes the current recursion index into the step function', () => {
    const program = parseValidProgram(`base() = zero();
step(y, previous) = y;
pred(x) = primrec(base, step);`);

    expect(evaluatePrimRecFunction(program, 'pred', [0])).toBe(0);
    expect(evaluatePrimRecFunction(program, 'pred', [1])).toBe(0);
    expect(evaluatePrimRecFunction(program, 'pred', [6])).toBe(5);
  });

  it('evaluates multiplication built from addition', () => {
    const program = parseValidProgram(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);
mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);`);

    expect(evaluatePrimRecFunction(program, 'mul', [0, 9])).toBe(0);
    expect(evaluatePrimRecFunction(program, 'mul', [7, 0])).toBe(0);
    expect(evaluatePrimRecFunction(program, 'mul', [3, 4])).toBe(12);
  });

  it('evaluates functions with several fixed arguments before the recursion argument', () => {
    const program = parseValidProgram(`base(x, y) = x;
step(x, y, z, previous) = succ(previous);
addLastToFirst(x, y, z) = primrec(base, step);`);

    expect(evaluatePrimRecFunction(program, 'addLastToFirst', [5, 99, 4])).toBe(9);
  });

  it('evaluates factorial built from multiplication', () => {
    const program = parseValidProgram(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);
mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);
factBase() = 1;
factStep(y, previous) = mul(succ(y), previous);
fact(x) = primrec(factBase, factStep);`);

    expect(evaluatePrimRecFunction(program, 'fact', [0])).toBe(1);
    expect(evaluatePrimRecFunction(program, 'fact', [1])).toBe(1);
    expect(evaluatePrimRecFunction(program, 'fact', [5])).toBe(120);
  });

  it('evaluates built-in functions when called directly', () => {
    const program = parseValidProgram('');

    expect(evaluatePrimRecFunction(program, 'zero', [])).toBe(0);
    expect(evaluatePrimRecFunction(program, 'succ', [41])).toBe(42);
  });

  it('throws for an unknown function name', () => {
    const program = parseValidProgram('id(x) = x;');

    expect(() => evaluatePrimRecFunction(program, 'missing', [1])).toThrow(
      "Function 'missing' is not defined.",
    );
  });

  it('throws when the argument count does not match the function arity', () => {
    const program = parseValidProgram('id(x) = x;');

    expect(() => evaluatePrimRecFunction(program, 'id', [])).toThrow(
      "Function 'id' expects 1 argument(s), but got 0.",
    );
  });

  it('throws when an argument is not a natural number', () => {
    const program = parseValidProgram('id(x) = x;');

    expect(() => evaluatePrimRecFunction(program, 'id', [-1])).toThrow(
      "Argument 0 for 'id' must be a natural number.",
    );
    expect(() => evaluatePrimRecFunction(program, 'id', [1.5])).toThrow(
      "Argument 0 for 'id' must be a natural number.",
    );
  });
});
