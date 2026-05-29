import { describe, expect, it } from 'vitest';
import { lex } from './lexer';

describe('lex', () => {
  describe('basic tokens', () => {
    it('tokenizes a simple identifier', () => {
      const result = lex('foo');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.map((t) => t.kind)).toEqual(['identifier', 'eof']);
      expect(result.tokens[0].value).toBe('foo');
    });

    it('tokenizes identifiers with digits and underscores', () => {
      const result = lex('fn_123 abc_def x42');
      expect(result.diagnostics).toEqual([]);
      const values = result.tokens
        .filter((t) => t.kind !== 'eof')
        .map((t) => t.value);
      expect(values).toEqual(['fn_123', 'abc_def', 'x42']);
    });

    it('tokenizes punctuation characters', () => {
      const result = lex('( ) , ;');
      expect(result.diagnostics).toEqual([]);
      const tokens = result.tokens.filter((t) => t.kind !== 'eof');
      expect(tokens.map((t) => t.value)).toEqual(['(', ')', ',', ';']);
      tokens.forEach((t) => expect(t.kind).toBe('punctuation'));
    });

    it('tokenizes the equals operator', () => {
      const result = lex('=');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens[0].value).toBe('=');
      expect(result.tokens[0].kind).toBe('operator');
    });

    it('tokenizes numeric literals', () => {
      const result = lex('0 42 123456');
      expect(result.diagnostics).toEqual([]);
      expect(
        result.tokens.filter((t) => t.kind === 'number').map((t) => t.value),
      ).toEqual(['0', '42', '123456']);
    });

    it('tokenizes multi-digit numbers as single tokens', () => {
      const result = lex('999');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.filter((t) => t.kind !== 'eof')).toHaveLength(1);
      expect(result.tokens[0].value).toBe('999');
    });

    it('returns eof token at the end', () => {
      const result = lex('x');
      expect(result.tokens[result.tokens.length - 1].kind).toBe('eof');
    });
  });

  describe('comments', () => {
    it('ignores line comments only', () => {
      const result = lex(`# this is a line comment
f(x) = x;`);
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.map((t) => t.value).filter(Boolean)).toEqual([
        'f', '(', 'x', ')', '=', 'x', ';',
      ]);
    });

    it('ignores block comments only', () => {
      const result = lex(
        'id /* function name */ ( /* open */ x /* param */ ) = x;',
      );
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.map((t) => t.value).filter(Boolean)).toEqual([
        'id', '(', 'x', ')', '=', 'x', ';',
      ]);
    });

    it('handles multiple block comments in a row', () => {
      const result = lex('a /*1*/ b /*2*/ c');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.map((t) => t.value).filter(Boolean)).toEqual([
        'a', 'b', 'c',
      ]);
    });

    it('handles block comments spanning multiple lines', () => {
      const result = lex(`x = zero(); /* multi
line
comment */ y = succ(zero());`);
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.map((t) => t.value).filter(Boolean)).toEqual([
        'x', '=', 'zero', '(', ')', ';',
        'y', '=', 'succ', '(', 'zero', '(', ')', ')', ';',
      ]);
    });

    it('handles comment-like patterns inside identifiers', () => {
      const result = lex('hash_x slash_y');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.filter((t) => t.kind !== 'eof').map((t) => t.value)).toEqual([
        'hash_x', 'slash_y',
      ]);
    });

    it('reports unterminated block comments', () => {
      const result = lex('id(x) = x; /* never closed');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('LEX_UNTERMINATED_BLOCK_COMMENT');
    });

    it('reports unterminated block comment at end of file', () => {
      const result = lex('f(x) = x; /*');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('LEX_UNTERMINATED_BLOCK_COMMENT');
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const result = lex('');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens).toEqual([
        {
          kind: 'eof',
          value: '',
          range: {
            start: { offset: 0, line: 1, column: 1 },
            end: { offset: 0, line: 1, column: 1 },
          },
        },
      ]);
    });

    it('handles only whitespace', () => {
      const result = lex('   \t  \n  \r  ');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.filter((t) => t.kind !== 'eof')).toEqual([]);
    });

    it('handles only comments', () => {
      const result = lex('# just a comment');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.filter((t) => t.kind !== 'eof')).toEqual([]);
    });

    it('handles Windows-style line endings', () => {
      const result = lex('f(x) = x;\r\ng(x) = y;');
      expect(result.diagnostics).toEqual([]);
      const values = result.tokens.map((t) => t.value).filter(Boolean);
      expect(values).toContain('f');
      expect(values).toContain('g');
    });

    it('handles mixed whitespace before tokens', () => {
      const result = lex('\n\n  \t id(x)=\n x;');
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens.map((t) => t.value).filter(Boolean)).toEqual([
        'id', '(', 'x', ')', '=', 'x', ';',
      ]);
    });

    it('reports unknown characters', () => {
      const result = lex('x @ y');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('LEX_UNKNOWN_CHARACTER');
    });

    it('assigns source positions to tokens', () => {
      const result = lex('abc');
      expect(result.tokens[0].range.start).toEqual({
        offset: 0,
        line: 1,
        column: 1,
      });
      expect(result.tokens[0].range.end).toEqual({
        offset: 3,
        line: 1,
        column: 4,
      });
    });

    it('tracks line numbers correctly across newlines', () => {
      const result = lex('a\nb\nc');
      const ids = result.tokens.filter((t) => t.kind === 'identifier');
      expect(ids[0].range.start.line).toBe(1);
      expect(ids[1].range.start.line).toBe(2);
      expect(ids[2].range.start.line).toBe(3);
    });
  });

  describe('complex programs', () => {
    it('tokenizes a multi-function program', () => {
      const result = lex(`zeroUnary(x) = zero();
const42(x) = 42;
nested(x, y) = f(g(h(x, y), x), y);`);

      expect(result.diagnostics).toEqual([]);
      const values = result.tokens.map((t) => t.value).filter(Boolean);
      expect(values).toEqual([
        'zeroUnary', '(', 'x', ')', '=', 'zero', '(', ')', ';',
        'const42', '(', 'x', ')', '=', '42', ';',
        'nested', '(', 'x', ',', 'y', ')', '=', 'f', '(', 'g', '(',
        'h', '(', 'x', ',', 'y', ')', ',', 'x', ')', ',', 'y', ')', ';',
      ]);
    });

    it('tokenizes primrec syntax', () => {
      const result = lex('plus(x, y) = primrec(plusBase, plusStep);');
      expect(result.diagnostics).toEqual([]);
      const values = result.tokens.map((t) => t.value).filter(Boolean);
      expect(values).toEqual([
        'plus', '(', 'x', ',', 'y', ')', '=', 'primrec', '(',
        'plusBase', ',', 'plusStep', ')', ';',
      ]);
    });

    it('tokenizes deeply nested function calls', () => {
      const result = lex('w(x) = a(b(c(d(x))));');
      expect(result.diagnostics).toEqual([]);
      const values = result.tokens.map((t) => t.value).filter(Boolean);
      expect(values).toEqual([
        'w', '(', 'x', ')', '=', 'a', '(', 'b', '(', 'c', '(',
        'd', '(', 'x', ')', ')', ')', ')', ';',
      ]);
    });
  });
});
