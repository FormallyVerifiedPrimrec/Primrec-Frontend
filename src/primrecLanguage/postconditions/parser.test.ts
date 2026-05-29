import { describe, expect, it } from 'vitest';
import { parseCompleteProgram, parsePostconditions, parsePrimRecProgram } from '..';
import { parsePostconditionSyntax } from './parser';
import type { BinaryExpression, FormulaStatement, PostExpression } from './types';

function codes(source: string) {
  return parseCompleteProgram(source).diagnostics.map((item) => item.code);
}

function firstFormula(source: string): PostExpression {
  const result = parsePostconditionSyntax(source);
  const statement = result.ast.postconditions[0].statements[0] as FormulaStatement;
  return statement.expression;
}

function binary(expression: PostExpression): BinaryExpression {
  expect(expression.kind).toBe('BinaryExpression');
  return expression as BinaryExpression;
}

describe('postcondition parser', () => {
  it('parses a simple postcondition block', () => {
    const result = parsePostconditionSyntax(`post plus(x, y) -> r {
  r == x + y;
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.postconditions).toHaveLength(1);
    expect(result.ast.postconditions[0]).toMatchObject({
      functionName: 'plus',
      params: [{ name: 'x' }, { name: 'y' }],
      result: { name: 'r' },
    });
  });

  it('parses quantifiers, implication, division, modulo, and calls', () => {
    const result = parsePostconditionSyntax(`post gcd(x, y) -> r {
  r > 0 => x mod r == 0;
  forall d. d > 0 && x mod d == 0 => d <= r;
  r == ite(y == 0, x, gcd(y, x mod y));
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.postconditions[0].statements).toHaveLength(3);
  });

  it('keeps raw smt blocks as raw text', () => {
    const result = parsePostconditionSyntax(`smt {
  (declare-fun magic (Int Int) Bool)
}

post f(x) -> r {
  smt {
    (magic x r)
  }
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.smtBlocks[0].text).toContain('declare-fun magic');
    expect(result.ast.postconditions[0].statements[0].kind).toBe('RawSmtStatement');
  });

  it('validates referenced postcondition functions against PrimRec definitions', () => {
    const result = parseCompleteProgram(`plusBase(x) = x;
plusStep(x, y, previous) = succ(previous);
plus(x, y) = primrec(plusBase, plusStep);

post plus(x, y) -> r {
  r == x + y;
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.primrec.program?.functions.map((item) => item.name)).toEqual([
      'plusBase',
      'plusStep',
      'plus',
    ]);
    expect(result.postconditions.ast.postconditions).toHaveLength(1);
  });

  it('reports unknown postcondition function names', () => {
    expect(codes('id(x) = x;\npost missing(x) -> r { r == x; }')).toContain(
      'POST_VALIDATION_UNKNOWN_FUNCTION',
    );
  });

  it('reports postcondition function arity mismatches', () => {
    expect(codes('id(x) = x;\npost id(x, y) -> r { r == x; }')).toContain(
      'POST_VALIDATION_ARITY',
    );
  });

  it('reports unknown variables inside formulas', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { r == y; }')).toContain(
      'POST_VALIDATION_UNKNOWN_VARIABLE',
    );
  });

  it('reports unknown function calls inside formulas', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { r == missing(x); }')).toContain(
      'POST_VALIDATION_UNKNOWN_FUNCTION',
    );
  });

  it('checks PrimRec call arity inside postconditions', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { r == id(x, x); }')).toContain(
      'POST_VALIDATION_CALL_ARITY',
    );
  });

  it('checks divisible first argument', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { divisible(x, r); }')).toContain(
      'POST_VALIDATION_DIVISIBLE_NUMERAL',
    );
  });

  it('lets the PrimRec parser ignore postcondition blocks', () => {
    const result = parsePrimRecProgram(`id(x) = x;

post id(x) -> r {
  r == x;
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions.map((item) => item.name)).toEqual(['id']);
  });

  it('lets the postcondition parser ignore PrimRec code', () => {
    const result = parsePostconditions(`id(x) = x;

post id(x) -> r {
  r == x;
}`);

    expect(result.ast.postconditions).toHaveLength(1);
  });

  it('parses multiple postcondition blocks in one file', () => {
    const result = parsePostconditionSyntax(`post plus(x, y) -> r {
  r == x + y;
}

post mul(x, y) -> r {
  r == x * y;
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.postconditions.map((item) => item.functionName)).toEqual([
      'plus',
      'mul',
    ]);
  });

  it('parses zero-arity postconditions', () => {
    const result = parsePostconditionSyntax('post constZero() -> r { r == 0; }');

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.postconditions[0].params).toEqual([]);
  });

  it('parses all comparison operators', () => {
    const result = parsePostconditionSyntax(`post f(x, y) -> r {
  r == x;
  r != y;
  x < y;
  x <= y;
  x > y;
  x >= y;
}`);

    expect(result.diagnostics).toEqual([]);
    expect(
      (result.ast.postconditions[0].statements as FormulaStatement[]).map(
        (statement) => binary(statement.expression).operator,
      ),
    ).toEqual(['==', '!=', '<', '<=', '>', '>=']);
  });

  it('parses boolean connectives with precedence', () => {
    const expression = firstFormula(`post f(x, y, z) -> r {
  x == y || y == z && z == r;
}`);
    const root = binary(expression);

    expect(root.operator).toBe('||');
    expect(root.right.kind).toBe('BinaryExpression');
    expect((root.right as BinaryExpression).operator).toBe('&&');
  });

  it('parses implication as right-associative', () => {
    const expression = firstFormula(`post f(x, y, z) -> r {
  x == y => y == z => z == r;
}`);
    const root = binary(expression);

    expect(root.operator).toBe('=>');
    expect(root.right.kind).toBe('BinaryExpression');
    expect((root.right as BinaryExpression).operator).toBe('=>');
  });

  it('parses arithmetic precedence before comparison', () => {
    const expression = firstFormula(`post f(x, y, z) -> r {
  r == x + y * z;
}`);
    const root = binary(expression);
    const sum = binary(root.right);

    expect(root.operator).toBe('==');
    expect(sum.operator).toBe('+');
    expect(binary(sum.right).operator).toBe('*');
  });

  it('parses exponentiation as right-associative', () => {
    const expression = firstFormula(`post f(x, y, z) -> r {
  r == x ** y ** z;
}`);
    const root = binary(expression);
    const power = binary(root.right);

    expect(power.operator).toBe('**');
    expect(binary(power.right).operator).toBe('**');
  });

  it('parses unary operators', () => {
    const result = parsePostconditionSyntax(`post f(x) -> r {
  !(r == x);
  r == -x;
}`);

    expect(result.diagnostics).toEqual([]);
    const [notStatement, negativeStatement] = result.ast.postconditions[0]
      .statements as FormulaStatement[];
    expect(notStatement.expression.kind).toBe('UnaryExpression');
    expect(binary(negativeStatement.expression).right.kind).toBe('UnaryExpression');
  });

  it('parses parentheses overriding precedence', () => {
    const expression = firstFormula(`post f(x, y, z) -> r {
  r == (x + y) * z;
}`);
    const root = binary(expression);
    const product = binary(root.right);

    expect(product.operator).toBe('*');
    expect(binary(product.left).operator).toBe('+');
  });

  it('parses boolean constants', () => {
    const result = parsePostconditionSyntax(`post f(x) -> r {
  true;
  false;
}`);

    expect(result.diagnostics).toEqual([]);
    expect(
      (result.ast.postconditions[0].statements as FormulaStatement[]).map(
        (statement) => statement.expression.kind,
      ),
    ).toEqual(['BooleanExpression', 'BooleanExpression']);
  });

  it('parses distinct with multiple arguments', () => {
    const expression = firstFormula(`post f(x, y) -> r {
  distinct(x, y, r);
}`);

    expect(expression).toMatchObject({
      kind: 'CallExpression',
      callee: 'distinct',
      args: [{ kind: 'IdentifierExpression' }, { kind: 'IdentifierExpression' }, { kind: 'IdentifierExpression' }],
    });
  });

  it('parses abs and divisible builtins', () => {
    const result = parsePostconditionSyntax(`post f(x) -> r {
  abs(r - x) <= 1;
  divisible(2, r);
}`);

    expect(result.diagnostics).toEqual([]);
    const [absStatement, divisibleStatement] = result.ast.postconditions[0]
      .statements as FormulaStatement[];
    expect(binary(absStatement.expression).left).toMatchObject({
      kind: 'CallExpression',
      callee: 'abs',
    });
    expect(divisibleStatement.expression).toMatchObject({
      kind: 'CallExpression',
      callee: 'divisible',
    });
  });

  it('parses ite expressions nested in arithmetic', () => {
    const expression = firstFormula(`post pred(x) -> r {
  r == ite(x == 0, 0, x - 1);
}`);

    expect(binary(expression).right).toMatchObject({
      kind: 'IteExpression',
    });
  });

  it('parses statement-level let bindings', () => {
    const result = parsePostconditionSyntax(`post div2(x) -> r {
  let q = x div 2;
  r == q;
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.postconditions[0].statements[0]).toMatchObject({
      kind: 'LetStatement',
      name: { name: 'q' },
    });
  });

  it('parses expression-level let bindings', () => {
    const expression = firstFormula(`post div2(x) -> r {
  r == let q = x div 2 in q;
}`);

    expect(binary(expression).right).toMatchObject({
      kind: 'LetExpression',
      name: { name: 'q' },
    });
  });

  it('allows later statements to use earlier statement-level lets', () => {
    const result = parseCompleteProgram(`id(x) = x;
post id(x) -> r {
  let q = x + 1;
  r <= q;
}`);

    expect(result.diagnostics).toEqual([]);
  });

  it('does not allow statement-level lets before they are declared', () => {
    expect(codes(`id(x) = x;
post id(x) -> r {
  r <= q;
  let q = x + 1;
}`)).toContain('POST_VALIDATION_UNKNOWN_VARIABLE');
  });

  it('does not leak expression-level let names outside their body', () => {
    expect(codes(`id(x) = x;
post id(x) -> r {
  r == let q = x in q;
  r == q;
}`)).toContain('POST_VALIDATION_UNKNOWN_VARIABLE');
  });

  it('allows quantified variables in their body', () => {
    const result = parseCompleteProgram(`id(x) = x;
post id(x) -> r {
  forall k. k <= x => k <= r;
  exists witness. witness == r;
}`);

    expect(result.diagnostics).toEqual([]);
  });

  it('does not leak quantified variables across statements', () => {
    expect(codes(`id(x) = x;
post id(x) -> r {
  forall k. k <= r;
  k == r;
}`)).toContain('POST_VALIDATION_UNKNOWN_VARIABLE');
  });

  it('parses quantifiers with multiple variables', () => {
    const expression = firstFormula(`post f(x) -> r {
  forall a, b. a <= b => a <= r;
}`);

    expect(expression).toMatchObject({
      kind: 'QuantifierExpression',
      variables: [{ name: 'a' }, { name: 'b' }],
    });
  });

  it('reports duplicate postcondition parameter names', () => {
    expect(codes('f(x, y) = x;\npost f(x, x) -> r { r == x; }')).toContain(
      'POST_VALIDATION_DUPLICATE_NAME',
    );
  });

  it('reports duplicate result names', () => {
    expect(codes('id(x) = x;\npost id(x) -> x { x == 0; }')).toContain(
      'POST_VALIDATION_DUPLICATE_NAME',
    );
  });

  it('reports duplicate statement-level lets', () => {
    expect(codes(`id(x) = x;
post id(x) -> r {
  let q = x;
  let q = r;
  r == q;
}`)).toContain('POST_VALIDATION_DUPLICATE_NAME');
  });

  it('reports duplicate quantified names in one quantifier', () => {
    expect(codes(`id(x) = x;
post id(x) -> r {
  forall k, k. k == r;
}`)).toContain('POST_VALIDATION_DUPLICATE_NAME');
  });

  it('allows quantified variables to shadow outer names', () => {
    const result = parseCompleteProgram(`id(x) = x;
post id(x) -> r {
  forall x. x <= r;
}`);

    expect(result.diagnostics).toEqual([]);
  });

  it('checks abs arity', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { abs(x, r) == 0; }')).toContain(
      'POST_VALIDATION_CALL_ARITY',
    );
  });

  it('checks divisible arity', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { divisible(2); }')).toContain(
      'POST_VALIDATION_CALL_ARITY',
    );
  });

  it('checks distinct arity', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { distinct(x); }')).toContain(
      'POST_VALIDATION_CALL_ARITY',
    );
  });

  it('rejects zero as divisible numeral', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { divisible(0, r); }')).toContain(
      'POST_VALIDATION_DIVISIBLE_NUMERAL',
    );
  });

  it('reports unsafe postcondition numeric literals', () => {
    expect(codes('id(x) = x;\npost id(x) -> r { r == 9007199254740992; }')).toContain(
      'POST_VALIDATION_UNSAFE_NUMBER_LITERAL',
    );
  });

  it('validates nested PrimRec calls in postconditions', () => {
    const result = parseCompleteProgram(`id(x) = x;
double(x) = id(id(x));
post double(x) -> r {
  r == id(id(x));
}`);

    expect(result.diagnostics).toEqual([]);
  });

  it('reports arity errors in nested PrimRec calls', () => {
    expect(codes(`id(x) = x;
double(x) = id(id(x));
post double(x) -> r {
  r == id(id(x, r));
}`)).toContain('POST_VALIDATION_CALL_ARITY');
  });

  it('handles comments inside postconditions', () => {
    const result = parseCompleteProgram(`id(x) = x;
post id(x) -> r {
  # line comment
  r == x; /* block comment */
}`);

    expect(result.diagnostics).toEqual([]);
  });

  it('handles comments around raw smt blocks', () => {
    const result = parsePostconditionSyntax(`smt /* comment */ {
  ; raw smt comment
  (assert true)
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.smtBlocks[0].text).toContain('(assert true)');
  });

  it('keeps nested braces inside raw smt text balanced', () => {
    const result = parsePostconditionSyntax(`smt {
  (echo "{ nested }")
}`);

    expect(result.diagnostics).toEqual([]);
    expect(result.ast.smtBlocks[0].text).toContain('{ nested }');
  });

  it('reports unterminated raw smt blocks', () => {
    const result = parsePostconditionSyntax(`smt {
  (assert true)`);

    expect(result.diagnostics.map((item) => item.code)).toContain(
      'POST_LEX_UNTERMINATED_SMT_BLOCK',
    );
  });

  it('reports missing semicolons in postcondition bodies', () => {
    const result = parsePostconditionSyntax(`post id(x) -> r {
  r == x
}`);

    expect(result.diagnostics.map((item) => item.code)).toContain(
      'POST_PARSE_UNEXPECTED_TOKEN',
    );
  });

  it('reports missing result arrow', () => {
    const result = parsePostconditionSyntax('post id(x) r { r == x; }');

    expect(result.diagnostics.map((item) => item.code)).toContain(
      'POST_PARSE_UNEXPECTED_TOKEN',
    );
  });

  it('recovers and parses a later postcondition after an invalid one', () => {
    const result = parsePostconditionSyntax(`post bad(x) -> r {
  r == ;
}

post good(x) -> r {
  r == x;
}`);

    expect(result.ast.postconditions.map((item) => item.functionName)).toEqual([
      'bad',
      'good',
    ]);
  });

  it('does not let top-level smt blocks disturb PrimRec parsing', () => {
    const result = parsePrimRecProgram(`smt {
  (declare-fun magic (Int Int) Bool)
}

id(x) = x;`);

    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions.map((item) => item.name)).toEqual(['id']);
  });

  it('does not let postcondition braces disturb later PrimRec parsing', () => {
    const result = parsePrimRecProgram(`id(x) = x;

post id(x) -> r {
  smt {
    (assert (= r x))
  }
}

next(x) = id(x);`);

    expect(result.diagnostics).toEqual([]);
    expect(result.program?.functions.map((item) => item.name)).toEqual([
      'id',
      'next',
    ]);
  });

  it('keeps original source ranges after masking postconditions for PrimRec', () => {
    const result = parsePrimRecProgram(`id(x) = x;

post id(x) -> r {
  r == x;
}

next(x) = id(x);`);

    expect(result.ast.definitions[1].name).toBe('next');
    expect(result.ast.definitions[1].nameRange.start.line).toBe(7);
  });

  it('validates postconditions against all PrimRec signatures despite ordering', () => {
    const result = parseCompleteProgram(`post later(x) -> r {
  r == x;
}

later(x) = x;`);

    expect(result.diagnostics).toEqual([]);
  });

  it('still reports PrimRec syntax errors independently of valid postconditions', () => {
    const result = parseCompleteProgram(`broken(x) = ;

post broken(x) -> r {
  r == x;
}`);

    expect(result.diagnostics.map((item) => item.code)).toContain(
      'PARSE_EXPECTED_EXPRESSION',
    );
  });
});
