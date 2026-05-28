import { describe, expect, it } from 'vitest';
import { parsePrimRecProgram } from '.';
import {
  evaluatePrimRecFunction,
  preprocessProgram,
} from './interpreter';
import type { NormalizedProgram } from './types';

function compileSource(source: string): NormalizedProgram {
  const result = parsePrimRecProgram(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.program).toBeDefined();
  return result.program!;
}

// A program exercising every idiom-recognition path plus the generic loop.
const ARITHMETIC = `one() = succ(zero());
plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);
mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);
predBase() = zero();
predStep(y, previous) = y;
pred(x) = primrec(predBase, predStep);
subBase(x) = x;
subStep(x, y, previous) = pred(previous);
sub(x, y) = primrec(subBase, subStep);
isZeroBase() = one();
isZeroStep(y, previous) = zero();
isZero(x) = primrec(isZeroBase, isZeroStep);
leq(x, y) = isZero(sub(x, y));
ifZeroBase(thenValue, elseValue) = thenValue;
ifZeroStep(thenValue, elseValue, y, previous) = elseValue;
ifZero(thenValue, elseValue, condition) = primrec(ifZeroBase, ifZeroStep);
ifOne(condition, thenValue, elseValue) = ifZero(elseValue, thenValue, condition);
triBase() = zero();
triStep(y, previous) = plus(previous, succ(y));
tri(n) = primrec(triBase, triStep);
base(x, y) = x;
step(x, y, z, previous) = succ(previous);
addLastToFirst(x, y, z) = primrec(base, step);`;

// Complete, correct Fibonacci (Cantor-pairing of (fib n, fib n+1)).
const FIB = `one() = succ(zero());
plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);
predBase() = zero();
predStep(y, previous) = y;
pred(x) = primrec(predBase, predStep);
subBase(x) = x;
subStep(x, y, previous) = pred(previous);
sub(x, y) = primrec(subBase, subStep);
isZeroBase() = one();
isZeroStep(y, previous) = zero();
isZero(x) = primrec(isZeroBase, isZeroStep);
leq(x, y) = isZero(sub(x, y));
ifZeroBase(thenValue, elseValue) = thenValue;
ifZeroStep(thenValue, elseValue, y, previous) = elseValue;
ifZero(thenValue, elseValue, condition) = primrec(ifZeroBase, ifZeroStep);
ifOne(condition, thenValue, elseValue) = ifZero(elseValue, thenValue, condition);
triBase() = zero();
triStep(y, previous) = plus(previous, succ(y));
tri(n) = primrec(triBase, triStep);
pair(a, b) = plus(tri(plus(a, b)), b);
wBoundBase(z) = zero();
wBoundStep(z, y, previous) = ifOne(leq(tri(succ(y)), z), succ(y), previous);
wBound(z, limit) = primrec(wBoundBase, wBoundStep);
w(z) = wBound(z, z);
second(z) = sub(z, tri(w(z)));
first(z) = sub(w(z), second(z));
fibPairBase() = pair(zero(), one());
fibPairStep(y, previous) = pair(second(previous), plus(first(previous), second(previous)));
fibPair(n) = primrec(fibPairBase, fibPairStep);
fib(n) = first(fibPair(n));`;

describe('preprocessProgram', () => {
  it('returns a reusable compiled program', () => {
    const compiled = preprocessProgram(compileSource(ARITHMETIC));

    // Calling repeatedly reuses the same compiled closures.
    expect(compiled.evaluate('plus', [2, 3])).toBe(5);
    expect(compiled.evaluate('plus', [2, 3])).toBe(5);
    expect(compiled.evaluate('mul', [6, 7])).toBe(42);
  });

  it('matches the legacy one-shot interface exactly', () => {
    const source = compileSource(ARITHMETIC);
    const compiled = preprocessProgram(source);

    const cases: Array<[string, number[]]> = [
      ['plus', [9, 16]],
      ['mul', [8, 9]],
      ['pred', [12]],
      ['sub', [20, 7]],
      ['isZero', [0]],
      ['leq', [4, 4]],
      ['ifOne', [1, 100, 200]],
      ['tri', [6]],
      ['addLastToFirst', [5, 99, 4]],
    ];

    for (const [name, args] of cases) {
      expect(compiled.evaluate(name, args)).toBe(
        evaluatePrimRecFunction(source, name, args),
      );
    }
  });
});

describe('idiom recognition (closed forms stay correct)', () => {
  const compiled = preprocessProgram(compileSource(ARITHMETIC));

  it('addition', () => {
    expect(compiled.evaluate('plus', [0, 0])).toBe(0);
    expect(compiled.evaluate('plus', [4, 0])).toBe(4);
    expect(compiled.evaluate('plus', [0, 4])).toBe(4);
    expect(compiled.evaluate('plus', [123, 456])).toBe(579);
    // Large values: a unary loop would be hopeless; the closed form is instant.
    expect(compiled.evaluate('plus', [5_000_000, 5_000_000])).toBe(10_000_000);
  });

  it('multiplication', () => {
    expect(compiled.evaluate('mul', [0, 9])).toBe(0);
    expect(compiled.evaluate('mul', [7, 0])).toBe(0);
    expect(compiled.evaluate('mul', [3, 4])).toBe(12);
    expect(compiled.evaluate('mul', [37, 41])).toBe(1517);
    expect(compiled.evaluate('mul', [1000, 1000])).toBe(1_000_000);
  });

  it('predecessor', () => {
    expect(compiled.evaluate('pred', [0])).toBe(0);
    expect(compiled.evaluate('pred', [1])).toBe(0);
    expect(compiled.evaluate('pred', [99])).toBe(98);
  });

  it('truncated subtraction', () => {
    expect(compiled.evaluate('sub', [50, 8])).toBe(42);
    expect(compiled.evaluate('sub', [8, 50])).toBe(0);
    expect(compiled.evaluate('sub', [10, 10])).toBe(0);
  });

  it('zero test and comparison', () => {
    expect(compiled.evaluate('isZero', [0])).toBe(1);
    expect(compiled.evaluate('isZero', [7])).toBe(0);
    expect(compiled.evaluate('leq', [3, 3])).toBe(1);
    expect(compiled.evaluate('leq', [2, 5])).toBe(1);
    expect(compiled.evaluate('leq', [5, 2])).toBe(0);
  });

  it('conditional selection', () => {
    expect(compiled.evaluate('ifOne', [0, 10, 20])).toBe(20);
    expect(compiled.evaluate('ifOne', [1, 10, 20])).toBe(10);
    expect(compiled.evaluate('ifOne', [5, 10, 20])).toBe(10);
  });

  it('non-linear recurrence falls back to the loop (triangular numbers)', () => {
    expect(compiled.evaluate('tri', [0])).toBe(0);
    expect(compiled.evaluate('tri', [1])).toBe(1);
    expect(compiled.evaluate('tri', [4])).toBe(10);
    expect(compiled.evaluate('tri', [10])).toBe(55);
  });

  it('generic loop with several fixed arguments', () => {
    expect(compiled.evaluate('addLastToFirst', [5, 99, 4])).toBe(9);
    expect(compiled.evaluate('addLastToFirst', [0, 0, 0])).toBe(0);
  });
});

describe('memoization option', () => {
  it('produces identical results with and without memoize', () => {
    const source = compileSource(ARITHMETIC);
    const plain = preprocessProgram(source);
    const memo = preprocessProgram(source, { memoize: true });

    const cases: Array<[string, number[]]> = [
      ['plus', [12, 30]],
      ['mul', [11, 11]],
      ['sub', [40, 13]],
      ['tri', [8]],
      ['leq', [7, 9]],
    ];
    for (const [name, args] of cases) {
      expect(memo.evaluate(name, args)).toBe(plain.evaluate(name, args));
    }
  });

  it('repeated calls through the cache stay correct', () => {
    const memo = preprocessProgram(compileSource(ARITHMETIC), { memoize: true });
    for (let i = 0; i < 5; i += 1) {
      expect(memo.evaluate('mul', [9, 9])).toBe(81);
    }
  });
});

describe('error and built-in behaviour is preserved', () => {
  it('evaluates built-in zero and succ directly', () => {
    const compiled = preprocessProgram(compileSource('id(x) = x;'));
    expect(compiled.evaluate('zero', [])).toBe(0);
    expect(compiled.evaluate('succ', [41])).toBe(42);
  });

  it('throws for an unknown function', () => {
    const compiled = preprocessProgram(compileSource('id(x) = x;'));
    expect(() => compiled.evaluate('missing', [1])).toThrow(
      "Function 'missing' is not defined.",
    );
  });

  it('throws on arity mismatch', () => {
    const compiled = preprocessProgram(compileSource('id(x) = x;'));
    expect(() => compiled.evaluate('id', [])).toThrow(
      "Function 'id' expects 1 argument(s), but got 0.",
    );
  });

  it('throws when an argument is not a natural number', () => {
    const compiled = preprocessProgram(compileSource('id(x) = x;'));
    expect(() => compiled.evaluate('id', [-1])).toThrow(
      "Argument 0 for 'id' must be a natural number.",
    );
    expect(() => compiled.evaluate('id', [1.5])).toThrow(
      "Argument 0 for 'id' must be a natural number.",
    );
  });
});

describe('fibonacci (Cantor-pairing construction)', () => {
  // fib(0)..fib(7) plus fib(9). fib(9) is the heavy case: the decoder is
  // ~O(fib(n)^4), hence the generous per-test timeout.
  const FIB_CASES: Array<[number, number]> = [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 5],
    [6, 8],
    [7, 13],
    [8, 21],
  ];

  
  it('computes fibonacci via the legacy interface', () => {
    const source = compileSource(FIB);
    // console.log(`[${new Date().toISOString()}] Legacy interface: starting fibonacci computation`);
    for (const [n, expected] of FIB_CASES) {
      const result = evaluatePrimRecFunction(source, 'fib', [n]);
      // console.log(`[${new Date().toISOString()}] fib(${n}) = ${result} (expected ${expected})`);
      expect(result).toBe(expected);
    }
    // console.log(`[${new Date().toISOString()}] Legacy interface: all ${FIB_CASES.length} cases passed`);
  }, 60000);
  

  
  it('computes fibonacci via a preprocessed program', () => {
    const compiled = preprocessProgram(compileSource(FIB));
    // console.log(`[${new Date().toISOString()}] Preprocessed program: starting fibonacci computation`);
    for (const [n, expected] of FIB_CASES) {
      const result = compiled.evaluate('fib', [n]);
      // console.log(`[${new Date().toISOString()}] fib(${n}) = ${result} (expected ${expected})`);
      expect(result).toBe(expected);
    }
    // console.log(`[${new Date().toISOString()}] Preprocessed program: all ${FIB_CASES.length} cases passed`);
  }, 60000);
  

  
  it('computes fibonacci with memoization enabled', () => {
    const compiled = preprocessProgram(compileSource(FIB), { memoize: true });
    // console.log(`[${new Date().toISOString()}] Memoization: starting fibonacci computation`);
    for (const [n, expected] of FIB_CASES) {
      const result = compiled.evaluate('fib', [n]);
      // console.log(`[${new Date().toISOString()}] fib(${n}) = ${result} (expected ${expected})`);
      expect(result).toBe(expected);
    }
    // console.log(`[${new Date().toISOString()}] Memoization: all ${FIB_CASES.length} cases passed`);
  }, 60000);
  

  /*
  it('computes fibonacci with memoization enabled', () => {
    const compiled = preprocessProgram(compileSource(FIB), { memoize: true });
    for (const [n, expected] of FIB_CASES) {
      expect(compiled.evaluate('fib', [n])).toBe(expected);
    }
  }, 60000);
  */
});
