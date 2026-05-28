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
`;
