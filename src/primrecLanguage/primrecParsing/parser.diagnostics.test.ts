import { describe, expect, it } from 'vitest';
import { parsePrimRecProgram } from '..';

function codes(source: string) {
  return parsePrimRecProgram(source).diagnostics.map((item) => item.code);
}

function allDiagnostics(source: string) {
  return parsePrimRecProgram(source).diagnostics;
}

describe('parsePrimRecProgram diagnostics', () => {
  describe('variable and scope errors', () => {
    it('rejects unknown variables', () => {
      expect(codes('f(x) = y;')).toContain('VALIDATION_UNKNOWN_VARIABLE');
    });

    it('rejects unknown variables in nested calls', () => {
      expect(codes('g(x) = succ(y);')).toContain('VALIDATION_UNKNOWN_VARIABLE');
    });

    it('rejects unknown variables in deeply nested calls', () => {
      expect(codes('f(x) = a;\ng(x) = f(h(y));')).toEqual(
        expect.arrayContaining(['VALIDATION_UNKNOWN_VARIABLE']),
      );
    });

    it('does not leak variables across function definitions', () => {
      expect(codes('f(x) = x;\ng(y) = x;')).toContain(
        'VALIDATION_UNKNOWN_VARIABLE',
      );
    });

    it('reports unknown variable at the correct location', () => {
      const result = parsePrimRecProgram('f(x) = z;');
      const diag = result.diagnostics.find(
        (d) => d.code === 'VALIDATION_UNKNOWN_VARIABLE',
      );
      expect(diag).toBeDefined();
      expect(diag!.range.start.column).toBe(8);
    });
  });

  describe('function call arity checks', () => {
    it('checks function call arity', () => {
      expect(codes('id(x) = x;\nbad(x) = id(x, x);')).toContain(
        'VALIDATION_CALL_ARITY',
      );
    });

    it('reports too few arguments', () => {
      expect(codes('f(a, b) = b;\ng(x) = f(x);')).toContain(
        'VALIDATION_CALL_ARITY',
      );
    });

    it('reports too many arguments', () => {
      expect(codes('f(a) = a;\ng(x, y, z) = f(x, y, z);')).toContain(
        'VALIDATION_CALL_ARITY',
      );
    });

    it('checks zero-arg function called with arguments', () => {
      expect(codes('f() = zero();\ng(x) = f(x);')).toContain(
        'VALIDATION_CALL_ARITY',
      );
    });

    it('checks zero-argument call on a unary function', () => {
      expect(codes('f(x) = x;\ng() = f();')).toContain(
        'VALIDATION_CALL_ARITY',
      );
    });

    it('checks arity for succ', () => {
      expect(codes('f(x) = succ(zero(), x);')).toContain(
        'VALIDATION_CALL_ARITY',
      );
    });

    it('checks arity for zero with arguments', () => {
      expect(codes('f(x) = zero(x);')).toContain('VALIDATION_CALL_ARITY');
    });

    it('reports arity errors for calls nested inside other calls', () => {
      expect(
        codes('f(x) = x;\ng(x, y) = f(x, y);\nh(x) = f(g(x));'),
      ).toContain('VALIDATION_CALL_ARITY');
    });
  });

  describe('numeric literal checks', () => {
    it('rejects numeric literals outside the safe integer range', () => {
      const result = parsePrimRecProgram('tooLarge() = 9007199254740992;');

      expect(result.diagnostics.map((item) => item.code)).toContain(
        'VALIDATION_UNSAFE_NUMBER_LITERAL',
      );
      expect(result.program).toBeUndefined();
    });
  });

  describe('forward references', () => {
    it('requires functions to be defined before use', () => {
      expect(codes('f(x) = g(x);\ng(x) = x;')).toContain(
        'VALIDATION_FORWARD_REFERENCE',
      );
    });

    it('reports forward reference when used as call argument', () => {
      expect(codes('a(x) = f(g(x));\nf(x) = x;\ng(x) = x;')).toContain(
        'VALIDATION_FORWARD_REFERENCE',
      );
    });

    it('reports forward reference for primrec base function', () => {
      expect(
        codes(`f(x, y) = primrec(base, step);
base(x) = x;
step(x, y, z) = succ(z);`),
      ).toContain('VALIDATION_FORWARD_REFERENCE');
    });

    it('reports forward reference for primrec step function', () => {
      expect(
        codes(`f(x, y) = primrec(base, step);
step(x, y, z) = succ(z);
base(x) = x;`),
      ).toContain('VALIDATION_FORWARD_REFERENCE');
    });
  });

  describe('primrec-specific errors', () => {
    it('checks primrec base and step arities', () => {
      expect(
        codes(`base(x) = x;
step(x) = x;
f(x, y) = primrec(base, step);`),
      ).toContain('VALIDATION_PRIMREC_ARITY');
    });

    it('checks primrec base has correct arity (n-1)', () => {
      expect(
        codes(`base(x, y) = y;
step(x, y, z) = succ(z);
f(x, y) = primrec(base, step);`),
      ).toContain('VALIDATION_PRIMREC_ARITY');
    });

    it('checks primrec step has correct arity (n+1)', () => {
      expect(
        codes(`base(x) = x;
step(x, y) = succ(y);
f(x, y) = primrec(base, step);`),
      ).toContain('VALIDATION_PRIMREC_ARITY');
    });

    it('rejects zero-parameter primrec', () => {
      expect(
        codes(`base() = zero();
step(x) = x;
f() = primrec(base, step);`),
      ).toContain('VALIDATION_PRIMREC_ARITY');
    });

    it('rejects primrec where base does not accept enough args', () => {
      expect(
        codes(`base() = zero();
step(x, y, z) = succ(z);
f(x, y) = primrec(base, step);`),
      ).toContain('VALIDATION_PRIMREC_ARITY');
    });

    it('rejects nested primrec expressions', () => {
      expect(
        codes(`base() = zero();
step(y, previous) = y;
f(x) = succ(primrec(base, step));`),
      ).toContain('VALIDATION_NESTED_PRIMREC');
    });

    it('rejects deeply nested primrec (2 levels of nesting)', () => {
      expect(
        codes(`base() = zero();
step(y, previous) = y;
f(x) = succ(succ(primrec(base, step)));`),
      ).toContain('VALIDATION_NESTED_PRIMREC');
    });

    it('rejects primrec nested inside another function call', () => {
      expect(
        codes(`base() = zero();
step(y, previous) = y;
f(x) = succ(primrec(base, step));
g(x) = f(primrec(base, step));`),
      ).toContain('VALIDATION_NESTED_PRIMREC');
    });

    it('rejects 4x nested primrec', () => {
      expect(
        codes(`base() = zero();
step(y, previous) = y;
f(x) = succ(succ(succ(succ(primrec(base, step)))));`),
      ).toContain('VALIDATION_NESTED_PRIMREC');
    });

    it('reports unknown functions when primrec base/step are undefined', () => {
      const result = codes('f(x) = primrec(x, x);');
      expect(result).toContain('VALIDATION_UNKNOWN_FUNCTION');
    });

    it('rejects primrec as a dependency name in primrec', () => {
      expect(
        codes(`f(x, y) = primrec(primrec, step);
step(x, y, z) = succ(z);`),
      ).toContain('VALIDATION_PRIMREC_AS_DEPENDENCY');
    });

    it('rejects primrec as step name in primrec', () => {
      expect(
        codes(`f(x, y) = primrec(base, primrec);
base(x) = x;`),
      ).toContain('VALIDATION_PRIMREC_AS_DEPENDENCY');
    });
  });

  describe('reserved names', () => {
    it('rejects redefining zero', () => {
      expect(codes('zero(x) = x;')).toContain(
        'VALIDATION_RESERVED_FUNCTION_NAME',
      );
    });

    it('rejects redefining succ', () => {
      expect(codes('succ(x, y) = y;')).toContain(
        'VALIDATION_RESERVED_FUNCTION_NAME',
      );
    });

    it('rejects redefining primrec', () => {
      expect(codes('primrec(x) = x;')).toContain(
        'VALIDATION_RESERVED_FUNCTION_NAME',
      );
    });

    it('rejects reserved names as parameters', () => {
      expect(codes('f(zero) = zero;')).toContain(
        'VALIDATION_RESERVED_PARAMETER_NAME',
      );
    });

    it('rejects succ as parameter name', () => {
      expect(codes('f(succ, x) = succ;')).toContain(
        'VALIDATION_RESERVED_PARAMETER_NAME',
      );
    });

    it('rejects primrec as parameter name', () => {
      expect(codes('f(primrec, y) = y;')).toContain(
        'VALIDATION_RESERVED_PARAMETER_NAME',
      );
    });
  });

  describe('duplicate definitions', () => {
    it('rejects duplicate function names', () => {
      expect(codes('f(x) = x;\nf(y) = y;')).toContain(
        'VALIDATION_DUPLICATE_FUNCTION',
      );
    });

    it('rejects multiple duplicate function names', () => {
      const result = parsePrimRecProgram(
        'f(x) = x;\nf(y) = y;\nf(z) = z;',
      );
      const dupes = result.diagnostics.filter(
        (d) => d.code === 'VALIDATION_DUPLICATE_FUNCTION',
      );
      expect(dupes).toHaveLength(2);
    });

    it('rejects duplicate parameter names', () => {
      expect(codes('f(x, x) = x;')).toContain(
        'VALIDATION_DUPLICATE_PARAMETER',
      );
    });

    it('rejects multiple duplicate parameters', () => {
      expect(codes('f(x, x, x) = x;')).toContain(
        'VALIDATION_DUPLICATE_PARAMETER',
      );
    });

    it('rejects parameter names that shadow each other', () => {
      expect(codes('f(a, b, a) = b;')).toContain(
        'VALIDATION_DUPLICATE_PARAMETER',
      );
    });
  });

  describe('unknown function references', () => {
    it('rejects calls to non-existent functions', () => {
      expect(codes('f(x) = g(x);')).toContain('VALIDATION_UNKNOWN_FUNCTION');
    });

    it('rejects non-existent functions in nested calls', () => {
      expect(codes('f(x) = g(h(x));')).toEqual(
        expect.arrayContaining(['VALIDATION_UNKNOWN_FUNCTION']),
      );
    });

    it('rejects non-existent base function in primrec', () => {
      expect(
        codes(`step(x, y, z) = succ(z);
f(x, y) = primrec(base, step);`),
      ).toContain('VALIDATION_UNKNOWN_FUNCTION');
    });

    it('rejects non-existent step function in primrec', () => {
      expect(
        codes(`base(x) = x;
f(x, y) = primrec(base, step);`),
      ).toContain('VALIDATION_UNKNOWN_FUNCTION');
    });
  });

  describe('recursion and cycle detection', () => {
    it('rejects direct self-recursion', () => {
      expect(codes('f(x) = f(x);')).toContain(
        'VALIDATION_GENERAL_RECURSION',
      );
    });

    it('rejects mutual recursion (2 functions)', () => {
      expect(codes('f(x) = g(x);\ng(x) = f(x);')).toContain(
        'VALIDATION_GENERAL_RECURSION',
      );
    });

    it('rejects mutual recursion (3 functions)', () => {
      expect(
        codes('f(x) = g(x);\ng(x) = h(x);\nh(x) = f(x);'),
      ).toContain('VALIDATION_GENERAL_RECURSION');
    });

    it('rejects 4-function cycle', () => {
      expect(
        codes(`a(x) = b(x);
b(x) = c(x);
c(x) = d(x);
d(x) = a(x);`),
      ).toContain('VALIDATION_GENERAL_RECURSION');
    });

    it('rejects indirect recursion through composition', () => {
      expect(codes('f(x) = g(x);\ng(x) = f(x);')).toContain(
        'VALIDATION_GENERAL_RECURSION',
      );
    });

    it('does not report cycles for valid dependent chains', () => {
      const result = codes('a(x) = zero();\nb(x) = a(x);\nc(x) = b(x);');
      expect(result).not.toContain('VALIDATION_GENERAL_RECURSION');
    });
  });

  describe('multiple errors', () => {
    it('reports multiple errors in one program', () => {
      const result = codes('f(x) = g(y);');
      expect(result).toContain('VALIDATION_UNKNOWN_FUNCTION');
      expect(result).toContain('VALIDATION_UNKNOWN_VARIABLE');
    });

    it('reports errors across multiple functions', () => {
      const result = codes('f(x) = y;\ng(x) = h(x);');
      expect(result).toContain('VALIDATION_UNKNOWN_VARIABLE');
      expect(result).toContain('VALIDATION_UNKNOWN_FUNCTION');
    });

    it('accumulates errors instead of short-circuiting', () => {
      const result = codes('f(x) = y;\ng(x) = succ(succ(y));');
      const varErrors = result.filter(
        (c) => c === 'VALIDATION_UNKNOWN_VARIABLE',
      );
      expect(varErrors.length).toBeGreaterThanOrEqual(2);
    });

    it('reports both arity and unknown function errors', () => {
      const result = codes('f(x) = g(x, x);');
      expect(result).toContain('VALIDATION_UNKNOWN_FUNCTION');
    });
  });

  describe('syntax errors', () => {
    it('reports missing semicolon', () => {
      const result = codes('f(x) = x');
      expect(result).toContain('PARSE_UNEXPECTED_TOKEN');
    });

    it('reports missing parenthesis in parameter list', () => {
      expect(codes('f x) = x;')).toContain('PARSE_UNEXPECTED_TOKEN');
    });

    it('reports missing closing parenthesis in function call', () => {
      expect(codes('f(x) = succ(x;')).toContain('PARSE_UNEXPECTED_TOKEN');
    });

    it('reports missing comma in primrec', () => {
      const result = codes('base(x) = x;\nstep(x,y,z)=succ(z);\nf(x,y)=primrec(base step);');
      expect(result).toContain('PARSE_UNEXPECTED_TOKEN');
    });

    it('reports missing equals sign', () => {
      expect(codes('f(x) x;')).toEqual(
        expect.arrayContaining(['PARSE_UNEXPECTED_TOKEN']),
      );
    });
  });

  describe('combined primrec and composition errors', () => {
    it('rejects primrec used in a call as nested with other errors', () => {
      const result = allDiagnostics(
        `base() = zero();
step(y, previous) = y;
f(x) = g(primrec(base, step));`,
      );
      const codes = result.map((d) => d.code);
      expect(codes).toContain('VALIDATION_NESTED_PRIMREC');
    });

    it('reports all errors when primrec base has wrong arity and is nested', () => {
      const result = allDiagnostics(
        `base(x) = x;
step(y, previous) = succ(previous);
f(x) = succ(primrec(base, step));`,
      );
      const codes = result.map((d) => d.code);
      expect(codes).toContain('VALIDATION_NESTED_PRIMREC');
    });
  });
});
