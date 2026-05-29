import { describe, expect, it } from 'vitest';
import {
  completeProgramToHornSmt2,
  completeProgramToHornSmt2Parts,
  parseCompleteProgram,
  postconditionProgramToHornSmt2,
  postconditionProgramToHornSmt2Parts,
} from '..';

function parseValidComplete(source: string) {
  const result = parseCompleteProgram(source);
  expect(result.diagnostics).toEqual([]);
  return result;
}

function generatePostconditions(source: string): string {
  return postconditionProgramToHornSmt2(parseValidComplete(source).postconditions);
}

describe('postconditionProgramToHornSmt2', () => {
  it('emits a false-headed violation clause for a simple formula', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  r == x;
}`);

    expect(smt2).toContain('(_id x r)');
    expect(smt2).toContain('(not (= r x))');
    expect(smt2).toContain('false');
    expect(smt2).toContain('(nat x)');
    expect(smt2).toContain('(nat r)');
  });

  it('emits one violation clause for each formula statement', () => {
    const parts = postconditionProgramToHornSmt2Parts(parseValidComplete(`id(x) = x;
post id(x) -> r {
  r >= x;
  r <= x;
}`).postconditions);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('(not (>= r x))');
    expect(parts[1]).toContain('(not (<= r x))');
  });

  it('keeps top-level raw SMT blocks as explicit output parts', () => {
    const parts = postconditionProgramToHornSmt2Parts(parseValidComplete(`id(x) = x;
smt {
  (declare-fun magic (Int Int) Bool)
}
post id(x) -> r {
  smt {
    (magic x r)
  }
}`).postconditions);

    expect(parts[0]).toBe('(declare-fun magic (Int Int) Bool)');
    expect(parts[1]).toContain('(not (magic x r))');
  });

  it('lowers PrimRec calls in postcondition expressions to relation atoms', () => {
    const smt2 = generatePostconditions(`id(x) = x;
double(x) = id(id(x));
post double(x) -> r {
  r == id(id(x));
}`);

    expect(smt2).toContain('(_id x callResult)');
    expect(smt2).toContain('(_id callResult callResult_1)');
    expect(smt2).toContain('(not (= r callResult_1))');
    expect(smt2).toContain('(nat callResult)');
    expect(smt2).toContain('(nat callResult_1)');
  });

  it('uses prefixed relations for postconditions on SMT-LIB builtin names', () => {
    const smt2 = completeProgramToHornSmt2(parseValidComplete(`mod(x, y) = x;
post mod(x, y) -> r {
  r == mod(x, y);
  r >= x mod y;
}`));

    expect(smt2).toContain('(declare-fun _mod (Int Int Int) Bool)');
    expect(smt2).toContain('(_mod x y r)');
    expect(smt2).toContain('(_mod x y callResult)');
    expect(smt2).toContain('(not (>= r (mod x y)))');
    expect(smt2).not.toContain('(declare-fun mod (Int Int Int) Bool)');
  });

  it('renders boolean, comparison, and arithmetic operators in SMT-LIB form', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  !(r != x) && r + 1 >= x * 1;
}`);

    expect(smt2).toContain(
      '(not (and (not (not (= r x))) (>= (+ r 1) (* x 1))))',
    );
  });

  it('renders divisible, abs, distinct, ite, and exponentiation in SMT-LIB form', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  distinct(abs(r - x), 0) && divisible(2, r) && r == ite(x == 0, 0, x ** 2);
}`);

    expect(smt2).toContain('(distinct (abs (- r x)) 0)');
    expect(smt2).toContain('((_ divisible 2) r)');
    expect(smt2).toContain('(declare-fun __primrec_pow (Int Int Int) Bool)');
    expect(smt2).toContain('(__primrec_pow x 2 powResult)');
    expect(smt2).toContain('(ite (= x 0) 0 powResult)');
    expect(smt2).not.toContain('(^');
  });

  it('makes statement-level lets available to later formulas', () => {
    const parts = postconditionProgramToHornSmt2Parts(parseValidComplete(`id(x) = x;
post id(x) -> r {
  let q = x + 1;
  r <= q;
  r != q;
}`).postconditions);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('(= q (+ x 1))');
    expect(parts[0]).toContain('(not (<= r q))');
    expect(parts[1]).toContain('(= q (+ x 1))');
    expect(parts[1]).toContain('(not (not (= r q)))');
  });

  it('keeps Nat guards for PrimRec call results introduced by statement lets', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  let q = id(x);
  r == q;
}`);

    expect(smt2).toContain('(_id x callResult)');
    expect(smt2).toContain('(= q callResult)');
    expect(smt2).toContain('(nat callResult)');
  });

  it('lowers expression-level lets without leaking source names', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  r == let q = x + 1 in q;
}`);

    expect(smt2).toContain('(= q (+ x 1))');
    expect(smt2).toContain('(not (= r q))');
  });

  it('renders forall and exists variables with Nat guards', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  forall d. d <= x => d <= r;
  exists witness. witness == r;
}`);

    expect(smt2).toContain('(forall ((d Int)) (=> (nat d) (=> (<= d x) (<= d r))))');
    expect(smt2).toContain('(exists ((witness Int)) (and (nat witness)');
    expect(smt2).toContain('(= witness r)');
  });

  it('keeps PrimRec call bindings inside quantified formulas', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  forall k. id(k) <= r;
}`);

    expect(smt2).toContain('(forall ((k Int))');
    expect(smt2).toContain('(exists ((callResult Int))');
    expect(smt2).toContain('(_id k callResult)');
    expect(smt2).toContain('(<= callResult r)');
  });

  it('renders raw SMT expressions as trusted inline SMT', () => {
    const smt2 = generatePostconditions(`id(x) = x;
post id(x) -> r {
  r == smt {
    (custom-id x)
  };
}`);

    expect(smt2).toContain('(not (= r (custom-id x)))');
  });

  it('rejects invalid postcondition parse results', () => {
    const result = parseCompleteProgram('id(x) = x;\npost missing(x) -> r { r == x; }');

    expect(() => postconditionProgramToHornSmt2Parts(result.postconditions)).toThrow(
      'Cannot generate Horn SMT-LIB for invalid postconditions.',
    );
  });
});

describe('completeProgramToHornSmt2', () => {
  it('combines PrimRec declarations, definitions, raw SMT, and postconditions', () => {
    const result = parseValidComplete(`id(x) = x;
smt {
  (declare-fun magic (Int Int) Bool)
}
post id(x) -> r {
  r == x;
}`);
    const parts = completeProgramToHornSmt2Parts(result);
    const smt2 = parts.join('\n\n');

    expect(parts[0]).toBe('(set-logic HORN)');
    expect(smt2).toContain('(define-fun nat');
    expect(smt2).toContain('(declare-fun _id (Int Int) Bool)');
    expect(smt2).toContain('(_id x r)');
    expect(smt2).toContain('(declare-fun magic (Int Int) Bool)');
    expect(smt2).toContain('(not (= r x))');
  });

  it('returns the same combined content as parts joined with blank lines', () => {
    const result = parseValidComplete(`id(x) = x;
post id(x) -> r {
  r == x;
}`);

    expect(completeProgramToHornSmt2(result)).toBe(
      completeProgramToHornSmt2Parts(result).join('\n\n'),
    );
  });

  it('rejects invalid complete programs before rendering partial SMT-LIB', () => {
    const result = parseCompleteProgram('f(x) = missing(x);\npost f(x) -> r { r == x; }');

    expect(() => completeProgramToHornSmt2Parts(result)).toThrow(
      'Cannot generate Horn SMT-LIB for an invalid complete program.',
    );
  });
});
