// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import { PrimitiveRecursionIdiomRecognizer } from './idioms';
import type {
  CoreExpression,
  NormalizedFunction,
  NormalizedProgram,
  PrimitiveRecursionIdiom,
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
  private readonly idioms: PrimitiveRecursionIdiomRecognizer;
  private readonly memoize: boolean;

  constructor(program: NormalizedProgram, options: PreprocessOptions) {
    this.memoize = options.memoize ?? false;
    for (const definition of program.functions) {
      this.definitions.set(definition.name, definition);
    }
    this.idioms = new PrimitiveRecursionIdiomRecognizer(this.definitions);
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
      case 'Number': {
        const value = toSafeNatural(expression.value);
        return () => value;
      }

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

    const idiom = this.idioms.recognize(definition, expression);
    const recognized = idiom
      ? this.compileRecognizedIdiom(idiom, base)
      : null;
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
  private compileRecognizedIdiom(
    idiom: PrimitiveRecursionIdiom,
    base: CompiledFunction,
  ): CompiledFunction | null {
    const counterIndex = idiom.counterIndex;
    switch (idiom.kind) {
      case 'Predecessor':
        return (args) =>
          args[counterIndex] === 0 ? base(args) : args[counterIndex] - 1;

      case 'ConstantAfterFirst': {
        const stepValue = this.compileExpression(idiom.expression);
        return (args) =>
          args[counterIndex] === 0 ? base(args) : stepValue(args);
      }

      case 'LinearRecurrence': {
        const increment = this.compileExpression(idiom.increment);
        return (args) =>
          toSafeNatural(base(args) + args[counterIndex] * increment(args));
      }
    }
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