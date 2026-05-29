export const LANGUAGE_ID = 'primitive-recursive-functions';

export const RESERVED_NAMES = new Set(['zero', 'succ', 'primrec']);

export const BUILTIN_SIGNATURES = {
  zero: { name: 'zero', arity: 0, builtin: true },
  succ: { name: 'succ', arity: 1, builtin: true },
} as const;

export const RECURSIVE_FUNCTIONS_EXAMPLE = `# Identity: id(x) = x

id(x) = x;

# Constant 1

one() =
  succ(zero());

# Predecessor: pred(succ(x)) = x,  pred(0) = 0

predBase() = zero();

predStep(y, previous) =
  y;

pred(x) = primrec(predBase, predStep);

# Addition: plus(x, y) = x + y

plusBase(x) = x;

plusStep(x, y, previous) =
  succ(previous);

plus(x, y) = primrec(plusBase, plusStep);

# Multiplication: mult(x, y) = x * y

multBase(x) = zero();

multStep(x, y, previous) =
  plus(previous, x);

mult(x, y) = primrec(multBase, multStep);
`;
