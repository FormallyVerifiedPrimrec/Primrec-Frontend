import { describe, expect, it } from 'vitest';
import {
  parsePrimRecProgram,
  recognizeIdiomsInParseResult,
} from '.';

const PROGRAM = `one() = succ(zero());
plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);
mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);
predBase() = zero();
predStep(y, previous) = y;
pred(x) = primrec(predBase, predStep);
isZeroBase() = one();
isZeroStep(y, previous) = zero();
isZero(x) = primrec(isZeroBase, isZeroStep);`;

describe('recognizeIdiomsInParseResult', () => {
  it('keeps the parse result shape and annotates recognized primrec bodies', () => {
    const parsed = parsePrimRecProgram(PROGRAM);
    const recognized = recognizeIdiomsInParseResult(parsed);

    expect(recognized.ast).toBe(parsed.ast);
    expect(recognized.tokens).toBe(parsed.tokens);
    expect(recognized.diagnostics).toBe(parsed.diagnostics);
    expect(recognized.program?.kind).toBe('PrimitiveRecursiveProgram');
    expect(recognized.program?.functions.map((item) => item.name)).toEqual(
      parsed.program?.functions.map((item) => item.name),
    );
  });

  it('reports the same idioms used by the preprocessor without compiling', () => {
    const recognized = recognizeIdiomsInParseResult(
      parsePrimRecProgram(PROGRAM),
    );
    const byName = new Map(
      recognized.program!.functions.map((definition) => [
        definition.name,
        definition,
      ]),
    );

    expect(byName.get('plus')?.expression).toMatchObject({
      kind: 'PrimitiveRecursion',
      idiom: {
        kind: 'LinearRecurrence',
        counterIndex: 1,
        previousIndex: 2,
        increment: {
          kind: 'Successor',
          argument: { kind: 'Number', value: 0 },
        },
      },
    });
    expect(byName.get('mul')?.expression).toMatchObject({
      kind: 'PrimitiveRecursion',
      idiom: {
        kind: 'LinearRecurrence',
        counterIndex: 1,
        previousIndex: 2,
        increment: { kind: 'Projection', parameter: 'x', index: 0 },
      },
    });
    expect(byName.get('pred')?.expression).toMatchObject({
      kind: 'PrimitiveRecursion',
      idiom: {
        kind: 'Predecessor',
        counterIndex: 0,
        previousIndex: 1,
      },
    });
    expect(byName.get('isZero')?.expression).toMatchObject({
      kind: 'PrimitiveRecursion',
      idiom: {
        kind: 'ConstantAfterFirst',
        counterIndex: 0,
        previousIndex: 1,
        expression: { kind: 'Zero' },
      },
    });
  });

  it('does not invent a program for invalid parse results', () => {
    const parsed = parsePrimRecProgram('f(x) = missing(x);');
    const recognized = recognizeIdiomsInParseResult(parsed);

    expect(parsed.program).toBeUndefined();
    expect(recognized.program).toBeUndefined();
    expect(recognized.diagnostics).toBe(parsed.diagnostics);
  });
});
