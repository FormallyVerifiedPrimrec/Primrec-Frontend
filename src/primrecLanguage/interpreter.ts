import type {
  CoreExpression,
  NormalizedFunction,
  NormalizedProgram,
} from './types';

export function evaluatePrimRecFunction(
  program: NormalizedProgram,
  functionName: string,
  args: number[],
): number {
  const interpreter = new PrimRecInterpreter(program);
  return interpreter.evaluate(functionName, args);
}

class PrimRecInterpreter {
  private readonly functions = new Map<string, NormalizedFunction>();

  constructor(program: NormalizedProgram) {
    for (const definition of program.functions) {
      this.functions.set(definition.name, definition);
    }
  }

  evaluate(functionName: string, args: number[]): number {
    return this.callFunction(functionName, args);
  }

  private callFunction(functionName: string, args: number[]): number {
    if (functionName === 'zero') {
      this.assertArity(functionName, 0, args);
      return 0;
    }

    if (functionName === 'succ') {
      this.assertArity(functionName, 1, args);
      return this.toSafeNatural(args[0] + 1, functionName);
    }

    const definition = this.functions.get(functionName);
    if (!definition) {
      throw new Error(`Function '${functionName}' is not defined.`);
    }

    this.assertArity(functionName, definition.arity, args);
    args.forEach((value, index) => {
      if (!isNaturalNumber(value)) {
        throw new Error(
          `Argument ${index} for '${functionName}' must be a natural number.`,
        );
      }
    });

    return this.evaluateExpression(definition.expression, args);
  }

  private evaluateExpression(expression: CoreExpression, args: number[]): number {
    switch (expression.kind) {
      case 'Projection': {
        const value = args[expression.index];
        if (value === undefined) {
          throw new Error(
            `Projection index ${expression.index} is outside the current argument list.`,
          );
        }
        return value;
      }

      case 'Zero':
        return 0;

      case 'Successor':
        return this.toSafeNatural(
          this.evaluateExpression(expression.argument, args) + 1,
          'succ',
        );

      case 'Composition': {
        const evaluatedArgs = expression.args.map((arg) =>
          this.evaluateExpression(arg, args),
        );
        return this.callFunction(expression.callee, evaluatedArgs);
      }

      case 'PrimitiveRecursion':
        return this.evaluatePrimitiveRecursion(expression, args);
    }
  }

  private evaluatePrimitiveRecursion(
    expression: Extract<CoreExpression, { kind: 'PrimitiveRecursion' }>,
    args: number[],
  ): number {
    if (args.length === 0) {
      throw new Error('Primitive recursion requires at least one argument.');
    }

    const fixedArgs = args.slice(0, -1);
    const recursionCount = args[args.length - 1];
    let result = this.callFunction(expression.base, fixedArgs);

    for (let current = 0; current < recursionCount; current += 1) {
      result = this.callFunction(expression.step, [
        ...fixedArgs,
        current,
        result,
      ]);
    }

    return result;
  }

  private assertArity(
    functionName: string,
    expected: number,
    args: number[],
  ) {
    if (args.length !== expected) {
      throw new Error(
        `Function '${functionName}' expects ${expected} argument(s), but got ${args.length}.`,
      );
    }
  }

  private toSafeNatural(value: number, functionName: string): number {
    if (!isNaturalNumber(value)) {
      throw new Error(`Function '${functionName}' produced an unsafe number.`);
    }

    return value;
  }
}

function isNaturalNumber(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
