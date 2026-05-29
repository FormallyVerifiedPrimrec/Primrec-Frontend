import { describe, expect, it } from 'vitest';
import { prepareSmtContext, buildFunctionSmt, buildFunctionSmtFromSource } from './smtBuilder';

const PROGRAM = `
plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);

mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);

post plus(x, y) -> r { r == x + y; }
post mul(x, y) -> r { r == x * y; }
`;

describe('buildFunctionSmt', () => {
  it('returns null for a function without a postcondition', () => {
    const ctx = prepareSmtContext(PROGRAM);
    expect(buildFunctionSmt(ctx, 'plusBase')).toBeNull();
  });

  it('emits a self-contained Horn problem for plus', () => {
    const smt = buildFunctionSmtFromSource(PROGRAM, 'plus');
    expect(smt).not.toBeNull();
    expect(smt).toContain('(set-logic HORN)');
    expect(smt).toContain('(declare-fun _plus');
    expect(smt).toContain('(declare-fun _plusBase');
    expect(smt).toContain('(declare-fun _plusStep');
    // plus does not need mul, so mul must not leak into its query.
    expect(smt).not.toContain('_mul');
    // The violation clause negates the postcondition and ends with check-sat.
    expect(smt).toContain('(not (= r (+ x y)))');
    expect(smt!.trimEnd().endsWith('(check-sat)')).toBe(true);
  });

  it('pulls in transitive dependencies for mul', () => {
    const smt = buildFunctionSmtFromSource(PROGRAM, 'mul')!;
    // mul -> mulBase, mulStep -> plus -> plusBase, plusStep
    for (const decl of ['_mul', '_mulBase', '_mulStep', '_plus', '_plusBase', '_plusStep']) {
      expect(smt).toContain(`(declare-fun ${decl}`);
    }
    // Only mul's postcondition is asserted, not plus's.
    expect(smt).toContain('(not (= r (* x y)))');
    expect(smt).not.toContain('(not (= r (+ x y)))');
  });

  it('includes functions referenced only by the postcondition', () => {
    const program = `
id(x) = x;
twiceBase() = zero();
twiceStep(y, previous) = succ(succ(previous));
twice(x) = primrec(twiceBase, twiceStep);
post twice(x) -> r { r == id(x) + id(x); }
`;
    const smt = buildFunctionSmtFromSource(program, 'twice')!;
    // id is not an implementation dependency of twice, only referenced in the
    // postcondition, but it must still be declared so the query is closed.
    expect(smt).toContain('(declare-fun _id');
  });
});
