import type {
  CoreExpression,
  NormalizedFunction,
  NormalizedProgram,
} from './types';

/**
 * A compiled (preprocessed) program. Building one walks every function body
 * exactly once and turns it into a tree of native JavaScript closures, so that
 * subsequent calls do not pay any AST-dispatch, name-lookup or validation cost
 * inside the hot loop. Reuse the same instance for many evaluations.
 */
export interface CompiledProgram {
  evaluate(functionName: string, args: number[]): number;
}

export interface PreprocessOptions {
  /**
   * Cache `(function, arguments) -> result` for user-defined functions. Helps
   * programs that evaluate the same sub-call repeatedly (e.g. a decoder used by
   * both `first` and `second`). Off by default because for plain arithmetic it
   * only wastes memory. Pure functions, so caching is always sound.
   */
  memoize?: boolean;
}

/**
 * Preprocess a program once so that the expensive compilation work is shared
 * across many `evaluate` calls. This is the fast path when you call the same
 * program repeatedly.
 */
export function preprocessProgram(
  program: NormalizedProgram,
  options: PreprocessOptions = {},
): CompiledProgram {
  return new CompiledProgramImpl(program, options);
}

/**
 * Convenience wrapper kept for backwards compatibility: preprocesses the
 * program and evaluates a single call. Identical behaviour to the original
 * interpreter; just faster. For many calls, prefer {@link preprocessProgram}.
 */
export function evaluatePrimRecFunction(
  program: NormalizedProgram,
  functionName: string,
  args: number[],
): number {
  return preprocessProgram(program).evaluate(functionName, args);
}

/** A fully compiled function: takes an argument array, returns a natural. */
type CompiledFunction = (args: number[]) => number;

const EMPTY_ARGS: number[] = [];

function isNaturalNumber(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function toSafeNatural(value: number): number {
  if (!isNaturalNumber(value)) {
    throw new Error("Function 'succ' produced an unsafe number.");
  }
  return value;
}

const ZERO_FN: CompiledFunction = () => 0;
const SUCC_FN: CompiledFunction = (args) => toSafeNatural(args[0] + 1);

class CompiledProgramImpl implements CompiledProgram {
  private readonly definitions = new Map<string, NormalizedFunction>();
  private readonly compiled = new Map<string, CompiledFunction>();
  private readonly additionCache = new Map<string, boolean>();
  private readonly memoize: boolean;

  constructor(program: NormalizedProgram, options: PreprocessOptions) {
    this.memoize = options.memoize ?? false;
    for (const definition of program.functions) {
      this.definitions.set(definition.name, definition);
    }
  }

  evaluate(functionName: string, args: number[]): number {
    // Built-ins keep exactly their original semantics (no natural-number check
    // on the raw argument; only the produced value is validated).
    if (functionName === 'zero') {
      this.assertArity(functionName, 0, args);
      return 0;
    }
    if (functionName === 'succ') {
      this.assertArity(functionName, 1, args);
      return toSafeNatural(args[0] + 1);
    }

    const definition = this.definitions.get(functionName);
    if (!definition) {
      throw new Error(`Function '${functionName}' is not defined.`);
    }

    // Validate once, at the entry point. Internal calls are guaranteed correct
    // by the normalizer (arities match, naturals stay natural, overflow is
    // caught in `succ`), so the hot path skips these checks entirely.
    this.assertArity(functionName, definition.arity, args);
    args.forEach((value, index) => {
      if (!isNaturalNumber(value)) {
        throw new Error(
          `Argument ${index} for '${functionName}' must be a natural number.`,
        );
      }
    });

    return this.resolve(functionName)(args);
  }

  /** Returns the compiled closure for a function name, compiling on demand. */
  private resolve(name: string): CompiledFunction {
    if (name === 'zero') return ZERO_FN;
    if (name === 'succ') return SUCC_FN;

    const existing = this.compiled.get(name);
    if (existing) return existing;

    const definition = this.definitions.get(name);
    if (!definition) {
      throw new Error(`Function '${name}' is not defined.`);
    }

    // The language forbids (mutual) recursion, so resolving dependencies while
    // compiling can never loop. Diamonds are fine: the first resolve caches.
    const fn = this.compileFunction(definition);
    this.compiled.set(name, fn);
    return fn;
  }

  private compileFunction(definition: NormalizedFunction): CompiledFunction {
    const body = definition.expression;
    if (body.kind === 'PrimitiveRecursion') {
      return this.compilePrimitiveRecursion(definition, body);
    }
    return this.compileExpression(body);
  }

  private compileExpression(expression: CoreExpression): CompiledFunction {
    switch (expression.kind) {
      case 'Zero':
        return ZERO_FN;

      case 'Projection': {
        const index = expression.index;
        return (args) => args[index];
      }

      case 'Successor': {
        const argument = this.compileExpression(expression.argument);
        return (args) => toSafeNatural(argument(args) + 1);
      }

      case 'Composition': {
        const callee = this.resolve(expression.callee);
        const argFns = expression.args.map((arg) => this.compileExpression(arg));
        const count = argFns.length;
        if (count === 0) {
          return () => callee(EMPTY_ARGS);
        }
        return (args) => {
          const evaluated = new Array<number>(count);
          for (let i = 0; i < count; i += 1) {
            evaluated[i] = argFns[i](args);
          }
          return callee(evaluated);
        };
      }

      case 'PrimitiveRecursion': {
        // primrec only ever appears as a complete body (validated), so this
        // branch is unreachable in practice. Handle it generically anyway.
        const base = this.resolve(expression.base);
        const step = this.resolve(expression.step);
        return genericPrimitiveRecursion(base, step);
      }
    }
  }

  private compilePrimitiveRecursion(
    definition: NormalizedFunction,
    expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
  ): CompiledFunction {
    const base = this.resolve(expression.base);
    const step = this.resolve(expression.step);

    const recognized = this.recognizeClosedForm(definition, expression, base);
    if (recognized) {
      return recognized;
    }
    let loop = genericPrimitiveRecursion(base, step, definition.arity);
    if (this.memoize) loop = withMemo(loop);
    return loop;
  }

  // ---------------------------------------------------------------------------
  // Idiom recognition: rewrite common primitive-recursion shapes into a
  // closed form, turning an O(count) loop into O(1). Every rule is matched on
  // structure only and is provably equivalent; anything unrecognised falls back
  // to the (correct) generic loop, so results never change.
  // ---------------------------------------------------------------------------
  private recognizeClosedForm(
    definition: NormalizedFunction,
    expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
    base: CompiledFunction,
  ): CompiledFunction | null {
    const arity = definition.arity; // f(x1..xn, count) -> arity = n + 1
    const n = arity - 1; // number of fixed arguments
    const counterIndex = n; // index of `y` in the step frame
    const previousIndex = n + 1; // index of `previous` in the step frame

    const stepDefinition = this.definitions.get(expression.step);
    if (!stepDefinition) {
      return null; // step is a builtin; not worth special-casing
    }
    const stepBody = stepDefinition.expression;

    // P3 — step returns the recursion counter `y` directly => predecessor:
    //   f(fixed, 0) = base(fixed);  f(fixed, k) = k - 1   (k >= 1)
    if (stepBody.kind === 'Projection' && stepBody.index === counterIndex) {
      return (args) => (args[n] === 0 ? base(args) : args[n] - 1);
    }

    // P1 — step ignores both `previous` and the counter => constant after the
    // first step:  f(fixed, 0) = base(fixed);  f(fixed, k) = step(fixed).
    // Covers isZero, ifZero, and similar "select" helpers.
    if (
      !referencesIndex(stepBody, previousIndex) &&
      !referencesIndex(stepBody, counterIndex)
    ) {
      const stepValue = this.compileExpression(stepBody);
      return (args) => (args[n] === 0 ? base(args) : stepValue(args));
    }

    // P2 — step is `previous + C`, with C independent of `previous` and the
    // counter => linear recurrence:  f(fixed, k) = base(fixed) + k * C(fixed).
    // Covers addition (C = 1) and multiplication (C = a fixed argument).
    const linear = this.analyzeLinear(stepBody, previousIndex, counterIndex);
    if (linear) {
      const constantTerm = linear;
      return (args) =>
        toSafeNatural(base(args) + args[n] * constantTerm(args));
    }

    return null;
  }

  /**
   * If `expression` (a step body) is equivalent to `previous + C` for some `C`
   * that depends only on the fixed arguments, returns a closure computing `C`;
   * otherwise null. Used to detect linear recurrences.
   */
  private analyzeLinear(
    expression: CoreExpression,
    previousIndex: number,
    counterIndex: number,
  ): CompiledFunction | null {
    switch (expression.kind) {
      case 'Projection':
        // Bare `previous` => previous + 0.
        return expression.index === previousIndex ? ZERO_FN : null;

      case 'Successor': {
        // succ(previous + C) => previous + (C + 1).
        const inner = this.analyzeLinear(
          expression.argument,
          previousIndex,
          counterIndex,
        );
        if (!inner) return null;
        return (args) => inner(args) + 1;
      }

      case 'Composition': {
        // add(previous + C, D) with D independent => previous + (C + D).
        if (expression.args.length !== 2 || !this.isAddition(expression.callee)) {
          return null;
        }
        const [left, right] = expression.args;
        const leftLinear = this.analyzeLinear(left, previousIndex, counterIndex);
        if (
          leftLinear &&
          isIndependent(right, previousIndex, counterIndex)
        ) {
          const other = this.compileExpression(right);
          return (args) => leftLinear(args) + other(args);
        }
        const rightLinear = this.analyzeLinear(
          right,
          previousIndex,
          counterIndex,
        );
        if (
          rightLinear &&
          isIndependent(left, previousIndex, counterIndex)
        ) {
          const other = this.compileExpression(left);
          return (args) => rightLinear(args) + other(args);
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Recognises the canonical addition definition (used to fold multiplication
   * into a closed form). Structural match only: a binary primrec whose base is
   * the identity projection and whose step is `succ(previous)`.
   */
  private isAddition(name: string): boolean {
    const cached = this.additionCache.get(name);
    if (cached !== undefined) return cached;
    this.additionCache.set(name, false); // break any accidental re-entry

    let result = false;
    const definition = this.definitions.get(name);
    if (
      definition &&
      definition.arity === 2 &&
      definition.expression.kind === 'PrimitiveRecursion'
    ) {
      const recursion = definition.expression;
      const baseDefinition = this.definitions.get(recursion.base);
      const stepDefinition = this.definitions.get(recursion.step);

      const baseIsIdentity =
        !!baseDefinition &&
        baseDefinition.arity === 1 &&
        baseDefinition.expression.kind === 'Projection' &&
        baseDefinition.expression.index === 0;

      const stepIsSuccPrevious =
        !!stepDefinition &&
        stepDefinition.arity === 3 &&
        stepDefinition.expression.kind === 'Successor' &&
        stepDefinition.expression.argument.kind === 'Projection' &&
        stepDefinition.expression.argument.index === 2;

      result = baseIsIdentity && stepIsSuccPrevious;
    }

    this.additionCache.set(name, result);
    return result;
  }

  private assertArity(functionName: string, expected: number, args: number[]) {
    if (args.length !== expected) {
      throw new Error(
        `Function '${functionName}' expects ${expected} argument(s), but got ${args.length}.`,
      );
    }
  }
}

/** The generic, always-correct primitive-recursion loop (bottom-up). */
function genericPrimitiveRecursion(
  base: CompiledFunction,
  step: CompiledFunction,
  arity?: number,
): CompiledFunction {
  return (args) => {
    const n = (arity ?? args.length) - 1;
    const count = args[n];
    let result = base(args); // base reads only the fixed arguments
    // Reuse one scratch array for the step frame [x1..xn, current, previous].
    const stepArgs = new Array<number>(n + 2);
    for (let i = 0; i < n; i += 1) {
      stepArgs[i] = args[i];
    }
    for (let current = 0; current < count; current += 1) {
      stepArgs[n] = current;
      stepArgs[n + 1] = result;
      result = step(stepArgs);
    }
    return result;
  };
}

/**
 * Per-function cap on memo entries. Programs can call a single helper (e.g.
 * `sub`/`tri`) with hundreds of millions of distinct large arguments; an
 * unbounded cache would exhaust memory. Once the cap is reached we stop adding
 * new entries (keeping the earliest, which suits the low-to-high access pattern
 * of bounded searches). Results stay correct regardless.
 */
const MEMO_ENTRY_LIMIT = 1 << 19; // ~524k entries per function

function withMemo(fn: CompiledFunction): CompiledFunction {
  const cache = new Map<string, number>();
  return (args) => {
    const key = args.join(',');
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = fn(args);
    if (cache.size < MEMO_ENTRY_LIMIT) {
      cache.set(key, value);
    }
    return value;
  };
}

/** True if `expression` reads the given argument index anywhere. */
function referencesIndex(expression: CoreExpression, index: number): boolean {
  switch (expression.kind) {
    case 'Projection':
      return expression.index === index;
    case 'Successor':
      return referencesIndex(expression.argument, index);
    case 'Composition':
      return expression.args.some((arg) => referencesIndex(arg, index));
    case 'Zero':
    case 'PrimitiveRecursion':
      return false;
  }
}

/** True if `expression` reads neither the `previous` nor the counter slot. */
function isIndependent(
  expression: CoreExpression,
  previousIndex: number,
  counterIndex: number,
): boolean {
  return (
    !referencesIndex(expression, previousIndex) &&
    !referencesIndex(expression, counterIndex)
  );
}
