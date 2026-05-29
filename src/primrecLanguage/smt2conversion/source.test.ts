import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  printToSmt2,
  sourceToHornSmt2,
  sourceToHornSmt2Parts,
} from '..';

describe('sourceToHornSmt2', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses complete source and returns generated SMT-LIB', () => {
    const smt2 = sourceToHornSmt2(`id(x) = x;
post id(x) -> r {
  r == x;
}`);

    expect(smt2).toContain('(set-logic HORN)');
    expect(smt2).toContain('(declare-fun _id (Int Int) Bool)');
    expect(smt2).toContain('(_id x r)');
    expect(smt2).toContain('(not (= r x))');
  });

  it('returns the same content as parts joined with blank lines', () => {
    const source = `id(x) = x;
post id(x) -> r {
  r == x;
}`;

    expect(sourceToHornSmt2(source)).toBe(sourceToHornSmt2Parts(source).join('\n\n'));
  });

  it('throws for invalid complete source', () => {
    expect(() => sourceToHornSmt2('f(x) = missing(x);')).toThrow(
      'Cannot generate Horn SMT-LIB for an invalid complete program.',
    );
  });

  it('prints and returns formatted SMT-LIB output', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const smt2 = printToSmt2('id(x) = x;');

    expect(smt2).toContain('(set-logic HORN)\n\n');
    expect(smt2).toContain('\n  (forall ');
    expect(log).toHaveBeenCalledWith(smt2);
  });
});
