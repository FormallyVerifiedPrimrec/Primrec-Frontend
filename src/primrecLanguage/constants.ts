// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

export const LANGUAGE_ID = 'primitive-recursive-functions';

export const RESERVED_NAMES = new Set(['zero', 'succ', 'primrec']);

export const BUILTIN_SIGNATURES = {
  zero: { name: 'zero', arity: 0, builtin: true },
  succ: { name: 'succ', arity: 1, builtin: true },
} as const;

export const COMPLETION_EXAMPLE = `# Addition

plusBase(x) = x;

plusStep(x, y, previous) =
  succ(previous);

plus(x, y) = primrec(plusBase, plusStep);

/*
  Multiplication
*/

mulBase(x) =
  zero();

mulStep(x, y, previous) =
  plus(previous, x);

mul(x, y) = primrec(mulBase, mulStep);

predBase() = zero();

predStep(y, previous) =
  y;

pred(x) = primrec(predBase, predStep);

square(x) =
  mul(x, x);

# Postconditions

post plus(x, y) -> r {
  r == x + y;
}

post mul(x, y) -> r {
  r == x * y;
}

post pred(x) -> r {
  x == 0 => r == 0;
  x > 0 => r == x - 1;
}

post square(x) -> r {
  r == x * x;
}
`;