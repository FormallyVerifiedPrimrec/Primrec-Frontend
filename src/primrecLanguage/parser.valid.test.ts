import { describe, expect, it } from 'vitest';
import { parsePrimRecProgram } from '.';
import type { CoreExpression } from './types';

describe('parsePrimRecProgram valid programs', () => {
  it('normalizes the addition example', () => {
    const result = parsePrimRecProgram(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);`);

    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions.map((item) => item.name)).toEqual([
      'plusBase',
      'plusStep',
      'plus',
    ]);
    expect(result.program?.functions[2].expression).toEqual({
      kind: 'PrimitiveRecursion',
      base: 'plusBase',
      step: 'plusStep',
    });
  });

  it('expands numeric literals into the primitive core', () => {
    const result = parsePrimRecProgram('two(x) = 2;');

    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Successor',
      argument: {
        kind: 'Successor',
        argument: { kind: 'Zero' },
      },
    });
  });

  it('normalizes a simple identity function', () => {
    const result = parsePrimRecProgram('id(x) = x;');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Projection',
      parameter: 'x',
      index: 0,
    });
  });

  it('normalizes zero-arity constant functions', () => {
    const result = parsePrimRecProgram('constZero() = zero();');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({ kind: 'Zero' });
  });

  it('normalizes successor application', () => {
    const result = parsePrimRecProgram('one(x) = succ(zero());');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Successor',
      argument: { kind: 'Zero' },
    });
  });

  it('normalizes double successor', () => {
    const result = parsePrimRecProgram('two(x) = succ(succ(zero()));');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Successor',
      argument: {
        kind: 'Successor',
        argument: { kind: 'Zero' },
      },
    });
  });

  it('normalizes composition of user-defined functions', () => {
    const result = parsePrimRecProgram(`f(x) = zero();
g(x) = f(x);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({ kind: 'Zero' });
    expect(result.program?.functions[1].expression).toEqual({
      kind: 'Composition',
      callee: 'f',
      args: [
        {
          kind: 'Projection',
          parameter: 'x',
          index: 0,
        },
      ],
    });
  });

  it('normalizes zero with arguments', () => {
    const result = parsePrimRecProgram('zeroArgs(x) = zero();');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({ kind: 'Zero' });
  });

  it('normalizes 0 as a numeric literal', () => {
    const result = parsePrimRecProgram('z(x) = 0;');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({ kind: 'Zero' });
  });

  it('normalizes 1 as successor of zero', () => {
    const result = parsePrimRecProgram('one(x) = 1;');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Successor',
      argument: { kind: 'Zero' },
    });
  });

  it('normalizes a larger numeric literal', () => {
    const result = parsePrimRecProgram('hundred(x) = 100;');
    expect(result.diagnostics).toEqual([]);
    const expr = result.program?.functions[0].expression;
    let node = expr;
    let count = 0;
    while (node?.kind === 'Successor') {
      count += 1;
      node = node.argument;
    }
    expect(count).toBe(100);
    expect(node).toEqual({ kind: 'Zero' });
  });

  it('normalizes composition with multiple arguments', () => {
    const result = parsePrimRecProgram(`g(a, b) = succ(a);
h(x, y, z) = g(x, y);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[1].expression).toEqual({
      kind: 'Composition',
      callee: 'g',
      args: [
        { kind: 'Projection', parameter: 'x', index: 0 },
        { kind: 'Projection', parameter: 'y', index: 1 },
      ],
    });
  });

  it('normalizes deeply nested function calls (2 levels)', () => {
    const result = parsePrimRecProgram(`f(x) = succ(x);
g(x) = f(f(x));`);
    expect(result.diagnostics).toEqual([]);
    const inner = { kind: 'Projection', parameter: 'x', index: 0 };
    expect(result.program?.functions[1].expression).toEqual({
      kind: 'Composition',
      callee: 'f',
      args: [
        {
          kind: 'Composition',
          callee: 'f',
          args: [inner],
        },
      ],
    });
  });

  it('normalizes deeply nested function calls (3 levels)', () => {
    const result = parsePrimRecProgram(`f(x) = succ(x);
g(x) = f(f(f(x)));`);
    expect(result.diagnostics).toEqual([]);
    const projX = { kind: 'Projection', parameter: 'x', index: 0 };
    const inner = {
      kind: 'Composition',
      callee: 'f',
      args: [projX],
    };
    const middle = {
      kind: 'Composition',
      callee: 'f',
      args: [inner],
    };
    expect(result.program?.functions[1].expression).toEqual({
      kind: 'Composition',
      callee: 'f',
      args: [middle],
    });
  });

  it('normalizes deeply nested function calls (4 levels)', () => {
    const result = parsePrimRecProgram(`f(x) = succ(x);
g(x) = f(f(f(f(x))));`);
    expect(result.diagnostics).toEqual([]);
    const projX = { kind: 'Projection', parameter: 'x', index: 0 };
    const l1 = { kind: 'Composition', callee: 'f', args: [projX] };
    const l2 = { kind: 'Composition', callee: 'f', args: [l1] };
    const l3 = { kind: 'Composition', callee: 'f', args: [l2] };
    expect(result.program?.functions[1].expression).toEqual({
      kind: 'Composition',
      callee: 'f',
      args: [l3],
    });
  });

  it('normalizes 4x nested calls with different functions', () => {
    const result = parsePrimRecProgram(`a(x) = succ(x);
b(x) = succ(x);
c(x) = succ(x);
d(x) = succ(x);
e(x) = a(b(c(d(x))));`);
    expect(result.diagnostics).toEqual([]);
    const projX = { kind: 'Projection', parameter: 'x', index: 0 };
    const dCall = { kind: 'Composition', callee: 'd', args: [projX] };
    const cCall = { kind: 'Composition', callee: 'c', args: [dCall] };
    const bCall = { kind: 'Composition', callee: 'b', args: [cCall] };
    expect(result.program?.functions[4].expression).toEqual({
      kind: 'Composition',
      callee: 'a',
      args: [bCall],
    });
    expect(result.program?.functions).toHaveLength(5);
  });

  it('normalizes nested calls with succ in 4 levels', () => {
    const result = parsePrimRecProgram(
      'deepSucc(x) = succ(succ(succ(succ(x))));',
    );
    expect(result.diagnostics).toEqual([]);
    const projX = { kind: 'Projection', parameter: 'x', index: 0 };
    const l1 = { kind: 'Successor', argument: projX };
    const l2 = { kind: 'Successor', argument: l1 };
    const l3 = { kind: 'Successor', argument: l2 };
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Successor',
      argument: l3,
    });
  });

  it('normalizes functions with many parameters', () => {
    const result = parsePrimRecProgram(
      'manyArgs(a, b, c, d, e, f, g) = a;',
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Projection',
      parameter: 'a',
      index: 0,
    });
    expect(result.program?.functions[0].arity).toBe(7);
    expect(result.program?.functions[0].parameters).toEqual([
      'a', 'b', 'c', 'd', 'e', 'f', 'g',
    ]);
  });

  it('normalizes a projection to the last parameter', () => {
    const result = parsePrimRecProgram('lastArg(a, b, c) = c;');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].expression).toEqual({
      kind: 'Projection',
      parameter: 'c',
      index: 2,
    });
  });

  it('normalizes a function with no parameters', () => {
    const result = parsePrimRecProgram('noparam() = zero();');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].arity).toBe(0);
    expect(result.program?.functions[0].parameters).toEqual([]);
  });

  it('normalizes the multiplication example', () => {
    const result = parsePrimRecProgram(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);
mulBase(x) = zero();
mulStep(x, y, previous) = plus(previous, x);
mul(x, y) = primrec(mulBase, mulStep);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions.map((f) => f.name)).toEqual([
      'plusBase',
      'plusStep',
      'plus',
      'mulBase',
      'mulStep',
      'mul',
    ]);
    expect(result.program?.functions[3].expression).toEqual({ kind: 'Zero' });
    expect(result.program?.functions[5].expression).toEqual({
      kind: 'PrimitiveRecursion',
      base: 'mulBase',
      step: 'mulStep',
    });
  });

  it('normalizes the predecessor function', () => {
    const result = parsePrimRecProgram(`predBase() = zero();
predStep(y, previous) = y;
pred(x) = primrec(predBase, predStep);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions).toHaveLength(3);
    expect(result.program?.functions[2].expression).toEqual({
      kind: 'PrimitiveRecursion',
      base: 'predBase',
      step: 'predStep',
    });
  });

  it('normalizes a program with many functions in correct order', () => {
    const result = parsePrimRecProgram(`zeroFn() = zero();
oneFn() = succ(zeroFn());
twoFn() = succ(oneFn());
threeFn() = succ(twoFn());
fourFn() = succ(threeFn());`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions).toHaveLength(5);
    expect(result.program?.functions[4].expression).toEqual({
      kind: 'Successor',
      argument: {
        kind: 'Composition',
        callee: 'threeFn',
        args: [],
      },
    });
  });

  it('normalizes chained compositions across multiple functions', () => {
    const result = parsePrimRecProgram(`f(x) = succ(x);
g(x) = f(x);
h(x) = g(x);
i(x) = h(x);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions).toHaveLength(4);
    const projX = { kind: 'Projection', parameter: 'x', index: 0 };
    expect(result.program?.functions[1].expression).toEqual({
      kind: 'Composition', callee: 'f', args: [projX],
    });
    expect(result.program?.functions[2].expression).toEqual({
      kind: 'Composition', callee: 'g', args: [projX],
    });
    expect(result.program?.functions[3].expression).toEqual({
      kind: 'Composition', callee: 'h', args: [projX],
    });
  });

  it('normalizes a function calling itself with different args via another function', () => {
    const result = parsePrimRecProgram(`f(x) = succ(x);
g(x) = f(x);
h(x) = f(g(x));`);
    expect(result.diagnostics).toEqual([]);
    const projX = { kind: 'Projection', parameter: 'x', index: 0 };
    const gCall = { kind: 'Composition', callee: 'g', args: [projX] };
    expect(result.program?.functions[2].expression).toEqual({
      kind: 'Composition',
      callee: 'f',
      args: [gCall],
    });
  });

  it('normalizes succ with a user-defined argument', () => {
    const result = parsePrimRecProgram(`f(x) = zero();
g(x) = succ(f(x));`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[1].expression).toEqual({
      kind: 'Successor',
      argument: {
        kind: 'Composition',
        callee: 'f',
        args: [
          { kind: 'Projection', parameter: 'x', index: 0 },
        ],
      },
    });
  });

  it('normalizes a function with multiple calls in one expression', () => {
    const result = parsePrimRecProgram(`f(x) = succ(x);
g(x, y) = f(x);
h(x, y) = g(f(x), f(y));`);
    expect(result.diagnostics).toEqual([]);
    const projX = { kind: 'Projection', parameter: 'x', index: 0 };
    const projY = { kind: 'Projection', parameter: 'y', index: 1 };
    const fX = { kind: 'Composition', callee: 'f', args: [projX] };
    const fY = { kind: 'Composition', callee: 'f', args: [projY] };
    expect(result.program?.functions[2].expression).toEqual({
      kind: 'Composition',
      callee: 'g',
      args: [fX, fY],
    });
  });

  it('collects correct function signatures', () => {
    const result = parsePrimRecProgram(`f(x) = x;
g(a, b, c) = b;
h() = zero();`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.signatures['f'].arity).toBe(1);
    expect(result.program?.signatures['g'].arity).toBe(3);
    expect(result.program?.signatures['h'].arity).toBe(0);
  });

  it('includes builtins in signatures', () => {
    const result = parsePrimRecProgram('f(x) = succ(zero());');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.signatures['zero']).toBeDefined();
    expect(result.program?.signatures['succ']).toBeDefined();
  });

  it('collects correct dependencies', () => {
    const result = parsePrimRecProgram(`f(x) = x;
g(x) = f(x);
h(x) = g(x);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].dependencies).toEqual([]);
    expect(result.program?.functions[1].dependencies).toEqual(['f']);
    expect(result.program?.functions[2].dependencies).toEqual(['g']);
  });

  it('collects dependencies for primrec functions', () => {
    const result = parsePrimRecProgram(`base(x) = x;
step(x, y, z) = succ(z);
rec(x, y) = primrec(base, step);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[2].dependencies.sort()).toEqual([
      'base',
      'step',
    ]);
  });

  it('normalizes primrec where base does not use the function parameter', () => {
    const result = parsePrimRecProgram(`base() = zero();
step(x, y) = succ(x);
rec(x) = primrec(base, step);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[2].expression).toEqual({
      kind: 'PrimitiveRecursion',
      base: 'base',
      step: 'step',
    });
  });

  it('normalizes primrec with complex step function body', () => {
    const result = parsePrimRecProgram(`base(x) = x;
step(x, y, previous) = succ(previous);
rec(x, y) = primrec(base, step);`);
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[2].expression).toEqual({
      kind: 'PrimitiveRecursion',
      base: 'base',
      step: 'step',
    });
  });

  it('normalizes program with mixed variable names and underscores', () => {
    const result = parsePrimRecProgram(
      'add_three(x) = succ(succ(succ(x)));',
    );
    expect(result.diagnostics).toEqual([]);
    let node = result.program?.functions[0].expression;
    for (let i = 0; i < 3; i++) {
      node = (node as { kind: string; argument: CoreExpression }).argument;
    }
    expect(node).toEqual({
      kind: 'Projection',
      parameter: 'x',
      index: 0,
    });
  });

  it('handles program with only one keyword-like identifier', () => {
    const result = parsePrimRecProgram('zeroish(x) = x;');
    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions[0].name).toBe('zeroish');
  });
});
