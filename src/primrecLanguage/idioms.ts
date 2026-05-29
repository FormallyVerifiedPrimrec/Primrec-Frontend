// Ported 1:1 from the PrimRecEditor reference implementation (primrecLanguage).
// This brings the up-to-date parser, validator, postcondition support and
// SMT-LIB Horn conversion into the frontend. Do not diverge from the editor
// copy without porting the change back there as well.

import type {
  CoreExpression,
  NormalizedFunction,
  NormalizedProgram,
  ParseResult,
  PrimitiveRecursionCoreExpression,
  PrimitiveRecursionIdiom,
} from './types';

const ZERO_EXPRESSION: CoreExpression = { kind: 'Number', value: 0 };

export function recognizeIdiomsInParseResult(result: ParseResult): ParseResult {
  if (!result.program) {
    return { ...result };
  }

  return {
    ...result,
    program: recognizeIdiomsInProgram(result.program),
  };
}

export function recognizeIdiomsInProgram(
  program: NormalizedProgram,
): NormalizedProgram {
  const definitions = new Map(
    program.functions.map((definition) => [definition.name, definition]),
  );
  const recognizer = new PrimitiveRecursionIdiomRecognizer(definitions);

  return {
    ...program,
    functions: program.functions.map((definition) => {
      if (definition.expression.kind !== 'PrimitiveRecursion') {
        return definition;
      }

      const idiom = recognizer.recognize(definition, definition.expression);
      if (!idiom) {
        return definition;
      }

      return {
        ...definition,
        expression: {
          ...definition.expression,
          idiom: cloneIdiom(idiom),
        },
      };
    }),
  };
}

export class PrimitiveRecursionIdiomRecognizer {
  private readonly additionCache = new Map<string, boolean>();
  // Explicit field instead of a TS parameter property: the frontend tsconfig
  // enables `erasableSyntaxOnly`, which disallows constructor parameter
  // properties. Behaviour is identical to the editor original.
  private readonly definitions: ReadonlyMap<string, NormalizedFunction>;

  constructor(definitions: ReadonlyMap<string, NormalizedFunction>) {
    this.definitions = definitions;
  }

  recognize(
    definition: NormalizedFunction,
    expression: PrimitiveRecursionCoreExpression,
  ): PrimitiveRecursionIdiom | null {
    const arity = definition.arity;
    if (arity < 1) {
      return null;
    }

    const fixedArgumentCount = arity - 1;
    const counterIndex = fixedArgumentCount;
    const previousIndex = fixedArgumentCount + 1;

    const stepDefinition = this.definitions.get(expression.step);
    if (!stepDefinition) {
      return null;
    }

    const stepBody = stepDefinition.expression;

    if (stepBody.kind === 'Projection' && stepBody.index === counterIndex) {
      return {
        kind: 'Predecessor',
        counterIndex,
        previousIndex,
      };
    }

    if (
      !referencesIndex(stepBody, previousIndex) &&
      !referencesIndex(stepBody, counterIndex)
    ) {
      return {
        kind: 'ConstantAfterFirst',
        counterIndex,
        previousIndex,
        expression: stepBody,
      };
    }

    const increment = this.analyzeLinearIncrement(
      stepBody,
      previousIndex,
      counterIndex,
    );
    if (increment) {
      return {
        kind: 'LinearRecurrence',
        counterIndex,
        previousIndex,
        increment,
      };
    }

    return null;
  }

  private analyzeLinearIncrement(
    expression: CoreExpression,
    previousIndex: number,
    counterIndex: number,
  ): CoreExpression | null {
    switch (expression.kind) {
      case 'Projection':
        return expression.index === previousIndex ? ZERO_EXPRESSION : null;

      case 'Successor': {
        const inner = this.analyzeLinearIncrement(
          expression.argument,
          previousIndex,
          counterIndex,
        );
        return inner ? { kind: 'Successor', argument: inner } : null;
      }

      case 'Composition': {
        if (expression.args.length !== 2 || !this.isAddition(expression.callee)) {
          return null;
        }

        const [left, right] = expression.args;
        const leftIncrement = this.analyzeLinearIncrement(
          left,
          previousIndex,
          counterIndex,
        );
        if (leftIncrement && isIndependent(right, previousIndex, counterIndex)) {
          return addExpressions(expression.callee, leftIncrement, right);
        }

        const rightIncrement = this.analyzeLinearIncrement(
          right,
          previousIndex,
          counterIndex,
        );
        if (rightIncrement && isIndependent(left, previousIndex, counterIndex)) {
          return addExpressions(expression.callee, rightIncrement, left);
        }

        return null;
      }

      default:
        return null;
    }
  }

  private isAddition(name: string): boolean {
    const cached = this.additionCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    this.additionCache.set(name, false);

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
}

function cloneIdiom(idiom: PrimitiveRecursionIdiom): PrimitiveRecursionIdiom {
  switch (idiom.kind) {
    case 'Predecessor':
      return { ...idiom };

    case 'ConstantAfterFirst':
      return {
        ...idiom,
        expression: cloneCoreExpression(idiom.expression),
      };

    case 'LinearRecurrence':
      return {
        ...idiom,
        increment: cloneCoreExpression(idiom.increment),
      };
  }
}

function cloneCoreExpression(expression: CoreExpression): CoreExpression {
  switch (expression.kind) {
    case 'Number':
    case 'Zero':
    case 'Projection':
      return { ...expression };

    case 'Successor':
      return {
        ...expression,
        argument: cloneCoreExpression(expression.argument),
      };

    case 'Composition':
      return {
        ...expression,
        args: expression.args.map(cloneCoreExpression),
      };

    case 'PrimitiveRecursion':
      return expression.idiom
        ? { ...expression, idiom: cloneIdiom(expression.idiom) }
        : { ...expression };
  }
}

function addExpressions(
  callee: string,
  left: CoreExpression,
  right: CoreExpression,
): CoreExpression {
  if (isZeroExpression(left)) {
    return right;
  }
  if (isZeroExpression(right)) {
    return left;
  }
  return {
    kind: 'Composition',
    callee,
    args: [left, right],
  };
}

function isZeroExpression(expression: CoreExpression): boolean {
  return (
    expression.kind === 'Zero' ||
    (expression.kind === 'Number' && expression.value === 0)
  );
}

export function referencesIndex(
  expression: CoreExpression,
  index: number,
): boolean {
  switch (expression.kind) {
    case 'Number':
      return false;

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