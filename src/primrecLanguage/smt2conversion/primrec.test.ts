import { describe, expect, it } from 'vitest';
import {
  parsePrimRecProgram,
  primRecProgramToHornSmt2,
  primRecProgramToHornSmt2Parts,
} from '..';

function generate(source: string): string {
  const parsed = parsePrimRecProgram(source);
  expect(parsed.diagnostics).toEqual([]);
  return primRecProgramToHornSmt2(parsed);
}

describe('primRecProgramToHornSmt2', () => {
  it('emits modular Horn SMT-LIB sections', () => {
    const parsed = parsePrimRecProgram('id(x) = x;');
    const parts = primRecProgramToHornSmt2Parts(parsed);

    expect(parts[0]).toBe('(set-logic HORN)');
    expect(parts[1]).toContain('(define-fun nat');
    expect(parts[2]).toBe('(declare-fun _id (Int Int) Bool)');
    expect(parts[3]).toContain('(_id x r)');
  });

  it('lowers plain expressions and nested composition through temporaries', () => {
    const smt2 = generate(`h(x) = succ(x);
z(n) = zero();
g(a, b) = succ(a);
f(x, n) = g(h(x), z(n));`);

    expect(smt2).toContain('(declare-fun _f (Int Int Int) Bool)');
    expect(smt2).toContain('(= arg0_1 x)');
    expect(smt2).toContain('(_h arg0_1 arg0)');
    expect(smt2).toContain('(= arg0_2 n)');
    expect(smt2).toContain('(_z arg0_2 arg1)');
    expect(smt2).toContain('(_g arg0 arg1 r)');
    expect(smt2).toContain('(_f x n r)');
  });

  it('keeps the result variable distinct from user parameters', () => {
    const smt2 = generate('constZero(r) = zero();');

    expect(smt2).toContain('(forall ((r Int) (r_1 Int))');
    expect(smt2).toContain('(= r_1 0)');
    expect(smt2).toContain('(_constZero r r_1)');
    expect(smt2).not.toContain('(_constZero r r)');
  });

  it('does not collide with user functions named Nat', () => {
    const smt2 = generate('Nat(x) = x;');

    expect(smt2).toContain('(define-fun nat');
    expect(smt2).toContain('(declare-fun _Nat (Int Int) Bool)');
    expect(smt2).toContain('(nat x)');
    expect(smt2).toContain('(_Nat x r)');
  });

  it('prefixes relation names that collide with SMT-LIB builtins', () => {
    const smt2 = generate(`mix(a, b) = a;
modBase(divisor) = zero();
modStep(divisor, y, previous) = mix(previous, divisor);
mod(divisor, n) = primrec(modBase, modStep);`);

    expect(smt2).toContain('(declare-fun _mod (Int Int Int) Bool)');
    expect(smt2).toContain('(_mod divisor previousCounter previous)');
    expect(smt2).toContain('(_mod divisor n r)');
    expect(smt2).not.toContain('(declare-fun mod (Int Int Int) Bool)');
  });

  it('uses recognized linear recurrence idioms instead of generic recursion', () => {
    const smt2 = generate(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);`);

    expect(smt2).toContain('(_plusBase x baseResult)');
    expect(smt2).toContain('(= succArg 0)');
    expect(smt2).toContain('(= increment (+ succArg 1))');
    expect(smt2).toContain('(= r (+ baseResult (* y increment)))');
    expect(smt2).not.toContain('previousCounter');
  });

  it('uses closed Horn rules for predecessor and constant-after-first idioms', () => {
    const smt2 = generate(`one() = succ(zero());
predBase() = zero();
predStep(y, previous) = y;
pred(x) = primrec(predBase, predStep);
isZeroBase() = one();
isZeroStep(y, previous) = zero();
isZero(x) = primrec(isZeroBase, isZeroStep);`);

    expect(smt2).toContain('(_predBase r)');
    expect(smt2).toContain('(= r (- x 1))');
    expect(smt2).toContain('(_isZeroBase r)');
    expect(smt2).toContain('(> x 0)');
    expect(smt2).toContain('(= r 0)');
  });

  it('falls back to generic primitive recursion when no idiom matches', () => {
    const smt2 = generate(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);
weirdBase(x) = x;
weirdStep(x, y, previous) = plus(x, y);
weird(x, y) = primrec(weirdBase, weirdStep);`);

    expect(smt2).toContain('(= y 0)');
    expect(smt2).toContain('(_weirdBase x r)');
    expect(smt2).toContain('(= y (+ previousCounter 1))');
    expect(smt2).toContain('(_weird x previousCounter previous)');
    expect(smt2).toContain('(_weirdStep x previousCounter previous r)');
  });

  it('rejects invalid parse results', () => {
    const parsed = parsePrimRecProgram('f(x) = missing(x);');

    expect(() => primRecProgramToHornSmt2Parts(parsed)).toThrow(
      'Cannot generate Horn SMT-LIB',
    );
  });
});
